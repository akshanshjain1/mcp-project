import * as cheerio from 'cheerio';

export interface SearchPayload {
    action: 'search';
    query: string;
    limit?: number;
    deepFetch?: boolean;  // Whether to fetch content from URLs
}

/**
 * Robust web search with DEEP URL FETCHING like ChatGPT
 * 1. Search DuckDuckGo for URLs
 * 2. Fetch top URLs and extract full page content
 * 3. Return comprehensive context for LLM
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

    log(`[Search] Starting search for: "${query}"`);
    log(`[Search] Deep Fetch: ${deepFetch}`);

    // Check if this is a news query
    const isNewsQuery = lowerQuery.includes('news') ||
        lowerQuery.includes('latest') ||
        lowerQuery.includes('recent');

    // For news queries, try Hacker News first
    if (isNewsQuery) {
        try {
            log('[Search] Trying Hacker News...');
            const newsResults = await searchHackerNews(query, limit);
            if (newsResults) {
                return `🔍 **Search Results for "${query}"**\n\n${newsResults}`;
            }
        } catch (error) {
            console.error('[Search] Hacker News failed:', error);
        }
    }

    // Try DuckDuckGo HTML scraping with deep fetch
    try {
        log('[Search] Trying DuckDuckGo HTML scraping...');
        const ddgResults = await scrapeDuckDuckGoHTML(query, limit, deepFetch, log);
        if (ddgResults) {
            return `🔍 **Search Results for "${query}"**\n\n${ddgResults}`;
        }
    } catch (error) {
        console.error('[Search] DuckDuckGo scraping failed:', error);
    }

    // Fallback to simple search without deep fetch
    log('[Search] Fallback to basic search...');
    return await fallbackSearch(query);
}

/**
 * Scrape DuckDuckGo + DEEP FETCH content from top URLs
 */
async function scrapeDuckDuckGoHTML(
    query: string,
    limit: number,
    deepFetch: boolean,
    log: (msg: string) => void
): Promise<string | null> {
    try {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

        log(`[Search] Fetching: ${url}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `q=${encodedQuery}`,
        });

        if (!response.ok) {
            console.error(`[Search] DDG HTML failed: ${response.status}`);
            return null;
        }

        const html = await response.text();
        log(`[Search] Got HTML response: ${html.length} bytes`);

        const $ = cheerio.load(html);
        const results: Array<{ title: string; url: string; snippet: string }> = [];

        // Parse DuckDuckGo HTML results
        $('.result').each((i, element) => {
            if (results.length >= limit) return false;

            const $el = $(element);
            const titleEl = $el.find('.result__a');
            const snippetEl = $el.find('.result__snippet');

            const title = titleEl.text().trim();
            const rawUrl = titleEl.attr('href') || '';
            const snippet = snippetEl.text().trim();

            if (title && rawUrl && !rawUrl.includes('duckduckgo.com')) {
                // Clean up the URL (DDG wraps URLs)
                let cleanUrl = rawUrl;
                if (rawUrl.includes('uddg=')) {
                    const match = rawUrl.match(/uddg=([^&]+)/);
                    if (match) {
                        cleanUrl = decodeURIComponent(match[1]);
                    }
                }

                results.push({ title, url: cleanUrl, snippet });
            }
        });

        log(`[Search] Found ${results.length} search results`);

        if (results.length === 0) {
            return null;
        }

        // DEEP FETCH: Get content from top URLs
        if (deepFetch && results.length > 0) {
            log('[Search] Starting deep fetch of top URLs...');
            const urlsToFetch = results.slice(0, 5);  // Fetch top 5 URLs

            const deepContent = await Promise.all(
                urlsToFetch.map(async (r, i) => {
                    const content = await fetchPageContent(r.url, r.title, log);
                    return {
                        ...r,
                        fullContent: content,
                        index: i + 1
                    };
                })
            );

            // Build comprehensive output
            const output: string[] = [];

            output.push('🌐 **Web Results with Full Content:**\n');

            for (const item of deepContent) {
                output.push(`---\n**[${item.index}] ${item.title}**`);
                output.push(`🔗 ${item.url}`);
                output.push(`\n📄 **Content:**`);
                if (item.fullContent) {
                    output.push(item.fullContent.substring(0, 3000));  // Limit per source
                } else {
                    output.push(`*${item.snippet}*`);
                }
                output.push('');
            }

            // Also include remaining results as snippets
            if (results.length > 5) {
                output.push('\n📋 **Additional Results:**\n');
                for (let i = 5; i < results.length; i++) {
                    const r = results[i];
                    output.push(`**${i + 1}. ${r.title}**\n${r.snippet}\n🔗 ${r.url}\n`);
                }
            }

            return output.join('\n');
        }

        // No deep fetch - just return snippets
        const formatted = results
            .map((r, i) => `**${i + 1}. ${r.title}**\n${r.snippet}\n🔗 ${r.url}`)
            .join('\n\n');

        return `🌐 **Web Results:**\n\n${formatted}`;
    } catch (error) {
        console.error('[Search] Scraping error:', error);
        return null;
    }
}

/**
 * Fetch and extract main content from a URL
 */
async function fetchPageContent(
    url: string,
    title: string,
    log: (msg: string) => void
): Promise<string | null> {
    try {
        log(`[Search] Fetching content from: ${url}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);  // 8s timeout

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
            log(`[Search] Skipping non-HTML content: ${contentType}`);
            return null;
        }

        const html = await response.text();
        log(`[Search] Got page content: ${html.length} bytes`);

        // Parse and extract main content
        const $ = cheerio.load(html);

        // Remove unwanted elements
        $('script, style, nav, header, footer, iframe, noscript, .ad, .ads, .advertisement, .sidebar, .menu, .navigation').remove();

        // Try to find main content
        let mainContent = '';

        // Try common content selectors
        const contentSelectors = [
            'article',
            'main',
            '.post-content',
            '.article-content',
            '.entry-content',
            '.content',
            '#content',
            '.post',
            '.blog-post',
            '[role="main"]',
        ];

        for (const selector of contentSelectors) {
            const el = $(selector);
            if (el.length > 0) {
                mainContent = el.text();
                break;
            }
        }

        // Fallback to body
        if (!mainContent) {
            mainContent = $('body').text();
        }

        // Clean up whitespace
        mainContent = mainContent
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n')
            .trim();

        if (mainContent.length < 100) {
            log(`[Search] Content too short for ${url}`);
            return null;
        }

        log(`[Search] Extracted ${mainContent.length} chars from ${url}`);
        return mainContent;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log(`[Search] Error fetching ${url}: ${errorMessage}`);
        return null;
    }
}

/**
 * Search Hacker News for tech news
 */
async function searchHackerNews(query: string, limit: number): Promise<string | null> {
    try {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://hn.algolia.com/api/v1/search?query=${encodedQuery}&tags=story&hitsPerPage=${limit}`;

        const response = await fetch(url, {
            headers: { 'User-Agent': 'MCP-Search-Adapter/1.0' },
        });

        if (!response.ok) return null;

        const data = await response.json() as {
            hits: Array<{
                title: string;
                url: string;
                points: number;
                author: string;
                created_at: string;
                objectID: string;
                num_comments: number;
            }>
        };

        if (!data.hits || data.hits.length === 0) return null;

        const articles = data.hits
            .slice(0, limit)
            .map((hit, i) => {
                const date = new Date(hit.created_at).toLocaleDateString();
                const hnLink = `https://news.ycombinator.com/item?id=${hit.objectID}`;
                return `**${i + 1}. ${hit.title}**\n📅 ${date} | ⬆️ ${hit.points} pts | 💬 ${hit.num_comments}\n🔗 ${hit.url || hnLink}`;
            })
            .join('\n\n');

        return `📰 **From Hacker News:**\n\n${articles}`;
    } catch {
        return null;
    }
}

/**
 * Fallback search when all else fails
 */
async function fallbackSearch(query: string): Promise<string> {
    return `🔍 **Search for "${query}"**

⚠️ Could not retrieve results. Try these direct links:

🌐 **Web Search:**
- [Google](https://www.google.com/search?q=${encodeURIComponent(query)})
- [DuckDuckGo](https://duckduckgo.com/?q=${encodeURIComponent(query)})

💼 **For Salary/Job Data:**
- [Levels.fyi](https://www.levels.fyi/search/?search=${encodeURIComponent(query)})
- [Glassdoor](https://www.glassdoor.com/Search/results.htm?keyword=${encodeURIComponent(query)})

💡 *Tip: Click the links above to search directly*`;
}
