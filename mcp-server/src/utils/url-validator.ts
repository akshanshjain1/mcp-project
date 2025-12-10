/**
 * URL Validator and Sanitizer
 * Validates, sanitizes, and auto-fixes URLs before browser operations
 */

export interface UrlValidation {
    isValid: boolean;
    sanitizedUrl?: string;
    error?: string;
    suggestions?: string[];
    protocol?: string;
    domain?: string;
}

// Common URL typos and their fixes
const COMMON_TYPOS: Record<string, string> = {
    'htp://': 'http://',
    'htps://': 'https://',
    'http//': 'http://',
    'https//': 'https://',
    'http:': 'http://',
    'https:': 'https://',
    'http:/': 'http://',
    'https:/': 'https://',
    'wwww.': 'www.',
    'ww.': 'www.',
    '.ocm': '.com',
    '.cmo': '.com',
    '.ogr': '.org',
    '.nte': '.net',
    '.oi': '.io',
};

// Known reliable domains (no key required)
const RELIABLE_DOMAINS = [
    // News & Information
    'wikipedia.org',
    'news.ycombinator.com',
    'github.com',
    'stackoverflow.com',
    'reddit.com',
    'medium.com',

    // APIs (free, no key)
    'api.github.com',
    'en.wikipedia.org',
    'hacker-news.firebaseio.com',
    'hn.algolia.com',
    'html.duckduckgo.com',
    'r.jina.ai',
    'wttr.in',
    'api.exchangerate-api.com',
    'api.coingecko.com',
    'ipapi.co',
    'worldtimeapi.org',
    'official-joke-api.appspot.com',
    'libretranslate.com',

    // Finance
    'query1.finance.yahoo.com',
    'query2.finance.yahoo.com',
    'finance.yahoo.com',

    // Development
    'raw.githubusercontent.com',
    'api.npms.io',
    'registry.npmjs.org',
    'pypi.org',

    // Educational
    'arxiv.org',
    'export.arxiv.org',
    'scholar.google.com',
];

// Suspicious patterns that indicate invalid URLs
const SUSPICIOUS_PATTERNS = [
    /localhost.*localhost/,          // Double localhost
    /\s/,                            // Contains spaces
    /[<>{}|\\\^`\[\]]/,             // Invalid URL characters
    /^javascript:/i,                 // JavaScript protocol
    /^data:/i,                       // Data URLs
    /^file:/i,                       // Local file URLs
    /\.{2,}/,                        // Multiple dots
    /-{3,}/,                         // Multiple dashes
    /\/{3,}/,                        // Multiple slashes (except protocol)
];

/**
 * Auto-fix common URL typos
 */
export function autoFixUrl(url: string): string {
    let fixed = url.trim();

    // Fix common protocol typos
    for (const [typo, fix] of Object.entries(COMMON_TYPOS)) {
        if (fixed.toLowerCase().startsWith(typo)) {
            fixed = fix + fixed.slice(typo.length);
            break;
        }
        // Also check in the middle of the URL
        if (fixed.toLowerCase().includes(typo)) {
            fixed = fixed.replace(new RegExp(typo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), fix);
        }
    }

    // Add https:// if no protocol
    if (!fixed.match(/^https?:\/\//i)) {
        // Check if it looks like a URL
        if (fixed.includes('.') && !fixed.includes(' ')) {
            fixed = 'https://' + fixed;
        }
    }

    // Fix double slashes in path (but not in protocol)
    fixed = fixed.replace(/(https?:\/\/)(.*)/, (_, protocol, rest) => {
        return protocol + rest.replace(/\/+/g, '/');
    });

    return fixed;
}

/**
 * Validate a URL and return detailed validation result
 */
export function validateUrl(url: string): UrlValidation {
    if (!url || typeof url !== 'string') {
        return {
            isValid: false,
            error: 'URL is required and must be a string',
        };
    }

    const trimmed = url.trim();

    if (trimmed.length === 0) {
        return {
            isValid: false,
            error: 'URL cannot be empty',
        };
    }

    // Check for suspicious patterns
    for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(trimmed)) {
            return {
                isValid: false,
                error: `URL contains invalid pattern: ${pattern.source}`,
                suggestions: [autoFixUrl(trimmed)],
            };
        }
    }

    // Try to auto-fix the URL
    const sanitized = autoFixUrl(trimmed);

    // Try to parse the URL
    try {
        const parsed = new URL(sanitized);

        // Must be http or https
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return {
                isValid: false,
                error: `Invalid protocol: ${parsed.protocol}. Only http and https are allowed.`,
                suggestions: [`https://${parsed.hostname}${parsed.pathname}`],
            };
        }

        // Domain must have at least one dot (except localhost)
        if (!parsed.hostname.includes('.') &&
            parsed.hostname !== 'localhost' &&
            !parsed.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
            return {
                isValid: false,
                error: `Invalid domain: ${parsed.hostname}`,
                suggestions: [`https://${parsed.hostname}.com`, `https://www.${parsed.hostname}.com`],
            };
        }

        return {
            isValid: true,
            sanitizedUrl: sanitized,
            protocol: parsed.protocol,
            domain: parsed.hostname,
        };
    } catch (e) {
        // URL parsing failed
        const suggestions: string[] = [];

        // Try to generate suggestions
        if (trimmed.includes('.')) {
            suggestions.push(`https://${trimmed}`);
            suggestions.push(`https://www.${trimmed}`);
        }

        return {
            isValid: false,
            error: `Invalid URL format: ${e instanceof Error ? e.message : 'Unknown error'}`,
            suggestions: suggestions.length > 0 ? suggestions : undefined,
        };
    }
}

/**
 * Check if URL points to a known reliable domain
 */
export function isReliableDomain(url: string): boolean {
    try {
        const parsed = new URL(url);
        return RELIABLE_DOMAINS.some(domain =>
            parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
        );
    } catch {
        return false;
    }
}

/**
 * Quick reachability check using HEAD request
 */
export async function isReachable(url: string, timeoutMs: number = 5000): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: {
                'User-Agent': 'MCP-URL-Validator/1.0',
            },
        });

        clearTimeout(timeout);

        // Consider 2xx, 3xx, and some 4xx as "reachable" (the server responded)
        return response.status < 500;
    } catch (error) {
        // Try GET request as fallback (some servers don't support HEAD)
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);

            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'User-Agent': 'MCP-URL-Validator/1.0',
                    'Range': 'bytes=0-0', // Only fetch first byte
                },
            });

            clearTimeout(timeout);
            return response.status < 500;
        } catch {
            return false;
        }
    }
}

/**
 * Generate helpful suggestions for failed URLs
 */
export function generateUrlSuggestions(query: string): string[] {
    const suggestions: string[] = [];
    const cleaned = query.trim().toLowerCase();

    // If it looks like a domain
    if (cleaned.includes('.') && !cleaned.includes(' ')) {
        suggestions.push(`https://${cleaned}`);
        suggestions.push(`https://www.${cleaned}`);
    }

    // If it looks like a search query
    if (cleaned.includes(' ') || !cleaned.includes('.')) {
        suggestions.push(`https://www.google.com/search?q=${encodeURIComponent(cleaned)}`);
        suggestions.push(`https://duckduckgo.com/?q=${encodeURIComponent(cleaned)}`);
    }

    // Common sites
    if (!cleaned.startsWith('http')) {
        suggestions.push(`https://${cleaned}.com`);
        suggestions.push(`https://${cleaned}.io`);
        suggestions.push(`https://${cleaned}.org`);
    }

    return [...new Set(suggestions)]; // Remove duplicates
}

/**
 * Get the list of reliable domains for browser tool
 */
export function getReliableDomains(): string[] {
    return [...RELIABLE_DOMAINS];
}
