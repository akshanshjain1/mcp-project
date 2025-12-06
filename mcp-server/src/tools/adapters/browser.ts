import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export interface BrowserPayload {
    action: 'fetch';
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: unknown;
}

const MCP_CONFIG_PATH = path.join(__dirname, '../../../mcp_servers.json');

const DEFAULT_ALLOWED_DOMAINS = [
    'api.github.com',
    'jsonplaceholder.typicode.com',
    'httpbin.org',
    'api.openweathermap.org',
    'api.exchangerate-api.com',
    'pokeapi.co',
    'swapi.dev',
    'finance.yahoo.com',
    'query1.finance.yahoo.com',
    'query2.finance.yahoo.com',
    'api.coingecko.com',
    'newsapi.org',
    'api.nytimes.com',
    'hacker-news.firebaseio.com',
    'api.ipify.org',
    'worldtimeapi.org'
];

function readAllowedDomains(): string[] {
    try {
        if (fs.existsSync(MCP_CONFIG_PATH)) {
            const content = fs.readFileSync(MCP_CONFIG_PATH, 'utf-8');
            const { domains } = JSON.parse(content);
            if (Array.isArray(domains)) {
                return domains;
            }
        }
    } catch (err) {
        console.warn('Failed to read mcp_servers.json, using defaults:', err);
    }
    return DEFAULT_ALLOWED_DOMAINS;
}

function writeAllowedDomains(domains: string[]): void {
    fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify({ domains }, null, 2), 'utf-8');
}

export function addMcpDomain(domain: string) {
    const domains = readAllowedDomains();
    if (!domains.includes(domain)) {
        domains.push(domain);
        writeAllowedDomains(domains);
    }
}

export function removeMcpDomain(domain: string) {
    const domains = readAllowedDomains().filter(d => d !== domain);
    writeAllowedDomains(domains);
}

export function listMcpDomains() {
    return readAllowedDomains();
}

function isAllowedUrl(url: string): boolean {
    try {
        const allowedDomains = readAllowedDomains();
        const parsed = new URL(url);

        // Check if domain is explicitly allowed
        if (allowedDomains.some(domain => parsed.hostname.endsWith(domain))) {
            return true;
        }

        // Allow localhost for development
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
            return true;
        }

        // Check for BROWSER_ALLOW_UNSAFE_URLS bypass
        const allowUnsafe = process.env.BROWSER_ALLOW_UNSAFE_URLS === 'true';
        if (allowUnsafe) {
            console.log(`[Browser] Allowing unsafe URL: ${url} (BROWSER_ALLOW_UNSAFE_URLS=true)`);
            return true;
        }

        return false;
    } catch {
        return false;
    }
}

export async function executeBrowser(payload: BrowserPayload): Promise<string> {
    const { url, method = 'GET', headers = {}, body } = payload;

    // Validate URL
    const allowUnsafe = process.env.BROWSER_ALLOW_UNSAFE_URLS === 'true';
    console.log(`[Browser] URL: ${url}, AllowUnsafe: ${allowUnsafe}, EnvVar: "${process.env.BROWSER_ALLOW_UNSAFE_URLS}"`);

    if (!allowUnsafe && !isAllowedUrl(url)) {
        throw new Error(`URL not allowed. Allowed domains: ${readAllowedDomains().join(', ')}, localhost. Set BROWSER_ALLOW_UNSAFE_URLS=true in .env to bypass.`);
    }

    try {
        // Use Jina Reader API for better content extraction (Markdown)
        // This handles dynamic content better and returns clean markdown
        const jinaUrl = `https://r.jina.ai/${url}`;

        const response = await fetch(jinaUrl, {
            method: 'GET', // Jina only supports GET
            headers: {
                'User-Agent': 'MCP-Browser-Adapter/1.0',
                ...headers,
            },
        });

        if (!response.ok) {
            // Fallback to direct fetch if Jina fails
            console.warn(`Jina Reader failed for ${url}, falling back to direct fetch.`);
            return await directFetch(url, method, headers, body);
        }

        const text = await response.text();

        // Truncate large responses
        const truncated = text.length > 15000
            ? text.substring(0, 15000) + '\n...(truncated)'
            : text;

        return `Fetched via Jina Reader:\n${truncated}`;

    } catch (error) {
        console.warn(`Jina Reader error: ${error}, falling back to direct fetch.`);
        return await directFetch(url, method, headers, body);
    }
}

async function directFetch(url: string, method: string, headers: any, body: any): Promise<string> {
    try {
        const requestOptions: RequestInit = {
            method,
            headers: {
                'User-Agent': 'MCP-Browser-Adapter/1.0',
                ...headers,
            },
        };

        if (body && (method === 'POST' || method === 'PUT')) {
            requestOptions.body = JSON.stringify(body);
            requestOptions.headers = {
                ...requestOptions.headers,
                'Content-Type': 'application/json',
            };
        }

        const response = await fetch(url, requestOptions);

        const contentType = response.headers.get('content-type') || '';
        let responseData: string;

        if (contentType.includes('application/json')) {
            const json = await response.json();
            responseData = JSON.stringify(json, null, 2);
        } else {
            responseData = await response.text();
        }

        // Truncate large responses
        const truncated = responseData.length > 5000
            ? responseData.substring(0, 5000) + '\n...(truncated)'
            : responseData;

        return `${method} ${url}\nStatus: ${response.status} ${response.statusText}\n\nResponse:\n${truncated}`;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Fetch failed: ${error.message}`);
        }
        throw error;
    }
}
