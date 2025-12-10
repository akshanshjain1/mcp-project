import * as cheerio from 'cheerio';

export interface SearchPayload {
    action: 'search';
    query: string;
    limit?: number;
    deepFetch?: boolean;
    sources?: ('duckduckgo' | 'wikipedia' | 'hackernews' | 'arxiv')[];
}

interface SearchSource {
    name: string;
    results: Array<{ title: string; url: string; snippet: string; source: string }>;
}

/**
 * Multi-source search with aggregation like Perplexity
 */
export async function executeSearch(
    payload: SearchPayload,
    onLog?: (message: string) => void
): Promise<string> {
    const { query, limit = 10, deepFetch = true } = payload;
    const lowerQuery = query.toLowerCase();

    const log = (msg: string) => {
        console.log(msg);
        if (onLog) onLog(msg);
    };

    if (!query || query.trim().length === 0) {
        throw new Error('Search query is required');
    }

    log(`[Search] ═══════════════════════════════════════════`);
    log(`[Search] Query: "${query}"`);
    log(`[Search] Deep Fetch: ${deepFetch}`);

    // Detect query type
    const isNewsQuery = lowerQuery.includes('news') || lowerQuery.includes('latest') || lowerQuery.includes('recent');
    const isAcademicQuery = lowerQuery.includes('research') || lowerQuery.includes('paper') || lowerQuery.includes('study') || lowerQuery.includes('scientific');
    const isFactualQuery = lowerQuery.startsWith('what is') || lowerQuery.startsWith('who is') || lowerQuery.startsWith('define');

    log(`[Search] Type: ${isNewsQuery ? 'News' : isAcademicQuery ? 'Academic' : isFactualQuery ? 'Factual' : 'General'}`);

    // Collect results from multiple sources in parallel
    const searchPromises: Promise<SearchSource | null>[] = [];

    // Always search DuckDuckGo as primary
    searchPromises.push(searchDuckDuckGo(query, limit, log));

    // Add Wikipedia for factual queries
    if (isFactualQuery || !isNewsQuery) {
        searchPromises.push(searchWikipedia(query, 3, log));
    }

    // Add Hacker News for news/tech queries
    if (isNewsQuery || lowerQuery.includes('tech') || lowerQuery.includes('ai') || lowerQuery.includes('programming')) {
        searchPromises.push(searchHackerNewsSource(query, 5, log));
    }

    // Add Arxiv for academic queries
    if (isAcademicQuery) {
        searchPromises.push(searchArxiv(query, 3, log));
    }

    // Execute all searches in parallel
    const sourceResults = await Promise.allSettled(searchPromises);

    // Aggregate results
    const allResults: Array<{ title: string; url: string; snippet: string; source: string }> = [];
    const seenUrls = new Set<string>();

    for (const result of sourceResults) {
        if (result.status === 'fulfilled' && result.value) {
            for (const item of result.value.results) {
                if (!seenUrls.has(item.url)) {
                    seenUrls.add(item.url);
                    allResults.push(item);
                }
            }
        }
    }

    log(`[Search] Total unique results: ${allResults.length}`);

    if (allResults.length === 0) {
        return fallbackSearch(query);
    }

    // Deep fetch top URLs
    if (deepFetch && allResults.length > 0) {
        log('[Search] Starting deep fetch...');
        const urlsToFetch = allResults.slice(0, 5);

        const deepContent = await Promise.all(
            urlsToFetch.map(async (r, i) => {
                const content = await fetchPageContent(r.url, r.title, log);
                return { ...r, fullContent: content, index: i + 1 };
            })
        );

        const output: string[] = ['🌐 **Multi-Source Search Results:**\n'];

        for (const item of deepContent) {
            output.push(`---\n**${item.index}. ${item.title}** [${item.source}]`);
            output.push(`🔗 ${item.url}`);
            output.push(`\n📄 **Content:**`);
            output.push(item.fullContent ? item.fullContent.substring(0, 3000) : `*${item.snippet}*`);
            output.push('');
        }

        if (allResults.length > 5) {
            output.push('\n📋 **Additional Results:**\n');
            for (let i = 5; i < Math.min(allResults.length, limit); i++) {
                const r = allResults[i];
                output.push(`**${i + 1}. ${r.title}** [${r.source}]\n${r.snippet}\n🔗 ${r.url}\n`);
            }
        }

        return `🔍 **Search Results for "${query}"**\n\n${output.join('\n')}`;
    }

    const formatted = allResults.slice(0, limit).map((r, i) =>
        `**${i + 1}. ${r.title}** [${r.source}]\n${r.snippet}\n🔗 ${r.url}`
    ).join('\n\n');

    return `🔍 **Search Results for "${query}"**\n\n🌐 **Web Results:**\n\n${formatted}`;
}

/**
 * Search Wikipedia API (free, no key required)
 */
async function searchWikipedia(query: string, limit: number, log: (msg: string) => void): Promise<SearchSource | null> {
    try {
        log('[Search] Searching Wikipedia...');
        const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&format=json&origin=*`;

        const response = await fetch(url, { headers: { 'User-Agent': 'MCP-Search-Adapter/1.0' } });
        if (!response.ok) return null;

        const data = await response.json() as any;
        const results = (data.query?.search || []).map((item: any) => ({
            title: item.title,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
            snippet: item.snippet.replace(/<[^>]*>/g, ''),
            source: 'Wikipedia'
        }));

        log(`[Search] Wikipedia: ${results.length} results`);
        return { name: 'Wikipedia', results };
    } catch (error) {
        log(`[Search] Wikipedia error: ${error}`);
        return null;
    }
}

/**
 * Search Arxiv API (free, no key required)
 */
async function searchArxiv(query: string, limit: number, log: (msg: string) => void): Promise<SearchSource | null> {
    try {
        log('[Search] Searching Arxiv...');
        const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}`;

        const response = await fetch(url, { headers: { 'User-Agent': 'MCP-Search-Adapter/1.0' } });
        if (!response.ok) return null;

        const xml = await response.text();
        const $ = cheerio.load(xml, { xmlMode: true });

        const results: Array<{ title: string; url: string; snippet: string; source: string }> = [];

        $('entry').each((_, entry) => {
            const $entry = $(entry);
            results.push({
                title: $entry.find('title').text().replace(/\n/g, ' ').trim(),
                url: $entry.find('id').text().trim(),
                snippet: $entry.find('summary').text().replace(/\n/g, ' ').substring(0, 300).trim() + '...',
                source: 'Arxiv'
            });
        });

        log(`[Search] Arxiv: ${results.length} results`);
        return { name: 'Arxiv', results };
    } catch (error) {
        log(`[Search] Arxiv error: ${error}`);
        return null;
    }
}

/**
 * Search Hacker News
 */
async function searchHackerNewsSource(query: string, limit: number, log: (msg: string) => void): Promise<SearchSource | null> {
    try {
        log('[Search] Searching Hacker News...');
        const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${limit}`;

        const response = await fetch(url, { headers: { 'User-Agent': 'MCP-Search-Adapter/1.0' } });
        if (!response.ok) return null;

        const data = await response.json() as any;
        const results = (data.hits || []).map((hit: any) => ({
            title: hit.title,
            url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
            snippet: `⬆️ ${hit.points} pts | 💬 ${hit.num_comments || 0} comments | ${new Date(hit.created_at).toLocaleDateString()}`,
            source: 'Hacker News'
        }));

        log(`[Search] Hacker News: ${results.length} results`);
        return { name: 'Hacker News', results };
    } catch (error) {
        log(`[Search] Hacker News error: ${error}`);
        return null;
    }
}

/**
 * Search DuckDuckGo HTML
 */
async function searchDuckDuckGo(query: string, limit: number, log: (msg: string) => void): Promise<SearchSource | null> {
    try {
        log('[Search] Searching DuckDuckGo...');
        const encodedQuery = encodeURIComponent(query);

        const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodedQuery}`, {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `q=${encodedQuery}`,
        });

        if (!response.ok) return null;

        const html = await response.text();
        const $ = cheerio.load(html);
        const results: Array<{ title: string; url: string; snippet: string; source: string }> = [];

        $('.result').each((i, element) => {
            if (results.length >= limit) return false;

            const $el = $(element);
            const titleEl = $el.find('.result__a');
            const snippetEl = $el.find('.result__snippet');

            const title = titleEl.text().trim();
            const rawUrl = titleEl.attr('href') || '';
            const snippet = snippetEl.text().trim();

            if (title && rawUrl && !rawUrl.includes('duckduckgo.com')) {
                let cleanUrl = rawUrl;
                if (rawUrl.includes('uddg=')) {
                    const match = rawUrl.match(/uddg=([^&]+)/);
                    if (match) cleanUrl = decodeURIComponent(match[1]);
                }
                results.push({ title, url: cleanUrl, snippet, source: 'DuckDuckGo' });
            }
        });

        log(`[Search] DuckDuckGo: ${results.length} results`);
        return { name: 'DuckDuckGo', results };
    } catch (error) {
        log(`[Search] DuckDuckGo error: ${error}`);
        return null;
    }
}

/**
 * Fetch and extract main content from a URL
 */
async function fetchPageContent(url: string, title: string, log: (msg: string) => void): Promise<string | null> {
    try {
        log(`[Search] Fetching: ${url}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html',
            },
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            log(`[Search] Failed to fetch ${url}: ${response.status}`);
            return null;
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) {
            log(`[Search] Skipping non-HTML: ${contentType}`);
            return null;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Remove unwanted elements
        $('script, style, nav, header, footer, iframe, noscript, .ad, .ads, .sidebar, .menu').remove();

        // Try to find main content
        let mainContent = '';
        const selectors = ['article', 'main', '.content', '#content', '.post-content', '[role="main"]'];

        for (const selector of selectors) {
            const el = $(selector);
            if (el.length > 0) {
                mainContent = el.text();
                break;
            }
        }

        if (!mainContent) mainContent = $('body').text();

        mainContent = mainContent.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n').trim();

        if (mainContent.length < 100) {
            log(`[Search] Content too short for ${url}`);
            return null;
        }

        log(`[Search] Extracted ${mainContent.length} chars from ${url}`);
        return mainContent;
    } catch (error) {
        log(`[Search] Error fetching ${url}: ${error instanceof Error ? error.message : 'Unknown'}`);
        return null;
    }
}

/**
 * Fallback search when all else fails
 */
function fallbackSearch(query: string): string {
    return `🔍 **Search for "${query}"**

⚠️ Could not retrieve results. Try these direct links:

🌐 **Web Search:**
- [Google](https://www.google.com/search?q=${encodeURIComponent(query)})
- [DuckDuckGo](https://duckduckgo.com/?q=${encodeURIComponent(query)})

📚 **Reference:**
- [Wikipedia](https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)})

💡 *Tip: Click the links above to search directly*`;
}
