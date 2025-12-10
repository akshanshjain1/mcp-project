import { ToolName } from '../validation';
import { executeFilesystem, FilesystemPayload } from './adapters/filesystem';
import { executeGithub, GithubPayload } from './adapters/github';
import { executeSlack, SlackPayload } from './adapters/slack';
import { executeCalendar, CalendarPayload } from './adapters/calendar';
import { executeTerminal, TerminalPayload } from './adapters/terminal';
import { executeBrowser, BrowserPayload } from './adapters/browser';
import { executeSearch, SearchPayload } from './adapters/search';
import { executeLeetCode, LeetCodePayload } from './adapters/leetcode';
import { executeMCPRegistry, MCPRegistryPayload } from './adapters/mcp_registry';
import { executeUtility, UtilityPayload } from './adapters/utilities';
import { executeCustomTool, CustomToolPayload, CustomToolConfig } from './adapters/custom';
import fs from 'fs';
import path from 'path';

type ToolPayload =
    | FilesystemPayload
    | GithubPayload
    | SlackPayload
    | CalendarPayload
    | TerminalPayload
    | BrowserPayload
    | SearchPayload
    | LeetCodePayload
    | LeetCodePayload
    | MCPRegistryPayload
    | UtilityPayload
    | CustomToolPayload;

export interface ToolDefinition {
    name: ToolName;
    description: string;
    payloadExample: Record<string, unknown>;
    enabled: boolean;
}

const TOOL_DEFINITIONS: ToolDefinition[] = [
    {
        name: 'filesystem',
        description: 'Read, write, list, delete LOCAL files only. NOT for web content - use search/browser for web. NEVER save web search results to files.',
        payloadExample: { action: 'write', path: 'notes.md', content: '# My Notes' },
        enabled: process.env.ENABLE_FILESYSTEM !== 'false', // Enabled by default
    },
    {
        name: 'github',
        description: 'Create issues, PRs, and fetch repository information',
        payloadExample: { action: 'create_issue', repo: 'owner/repo', title: 'Bug report', body: 'Description' },
        enabled: process.env.ENABLE_GITHUB !== 'false',
    },
    {
        name: 'slack',
        description: 'Send messages to Slack channels or users',
        payloadExample: { action: 'send_message', channel: '#general', message: 'Hello team!' },
        enabled: process.env.ENABLE_SLACK !== 'false',
    },
    {
        name: 'calendar',
        description: 'Create, list, and delete calendar events',
        payloadExample: { action: 'create_event', title: 'Meeting', date: '2024-01-15', time: '10:00' },
        enabled: process.env.ENABLE_CALENDAR !== 'false',
    },
    {
        name: 'terminal',
        description: 'Execute whitelisted terminal commands (ls, cat, echo, pwd, date, whoami)',
        payloadExample: { action: 'execute', command: 'ls -la' },
        enabled: process.env.ALLOW_TERMINAL === 'true', // Disabled by default for safety
    },
    {
        name: 'browser',
        description: 'Fetch content from URLs safely. For stock prices, use Yahoo Finance API',
        payloadExample: { action: 'fetch', url: 'https://query1.finance.yahoo.com/v8/finance/chart/AAPL', method: 'GET' },
        enabled: process.env.ENABLE_BROWSER !== 'false',
    },
    {
        name: 'search',
        description: 'Web search for news (HackerNews), facts, and definitions (DuckDuckGo/Wikipedia)',
        payloadExample: { action: 'search', query: 'latest AI news' },
        enabled: process.env.ENABLE_SEARCH !== 'false',
    },
    {
        name: 'leetcode',
        description: 'Fetch LeetCode problems with description, examples, and starter code',
        payloadExample: { action: 'get_problem', problemId: 1 },
        enabled: process.env.ENABLE_LEETCODE !== 'false',
    },
    {
        name: 'mcp_registry',
        description: 'Search for other MCP servers and tools (e.g. sqlite, postgres, etc.)',
        payloadExample: { action: 'search', query: 'database' },
        enabled: true,
    },
    {
        name: 'utility',
        description: 'Useful utilities: weather, time, currency/convert_currency, math, crypto, translate, ip, system, uuid, joke',
        payloadExample: { action: 'weather', location: 'London' },
        enabled: process.env.ENABLE_UTILITY !== 'false',
    },
];

// Load custom tools from JSON file
let CUSTOM_TOOLS: CustomToolConfig[] = [];
try {
    const customToolsPath = path.join(process.cwd(), 'custom_tools.json');
    if (fs.existsSync(customToolsPath)) {
        const content = fs.readFileSync(customToolsPath, 'utf-8');
        CUSTOM_TOOLS = JSON.parse(content);
        console.log(`Loaded ${CUSTOM_TOOLS.length} custom tools from custom_tools.json`);
    }
} catch (error) {
    console.warn('Failed to load custom_tools.json:', error);
}

export function getAvailableTools(): ToolDefinition[] {
    const builtIn = TOOL_DEFINITIONS.filter(t => t.enabled);

    const custom = CUSTOM_TOOLS.map(ct => ({
        name: ct.name as any as ToolName,
        description: ct.description,
        payloadExample: { toolName: ct.name, arg1: 'value' },
        enabled: true
    }));

    return [...builtIn, ...custom];
}

/**
 * Dispatch a tool with automatic fallback handling
 * - Browser failures fallback to search
 * - Returns structured result for chaining
 */
export async function dispatchTool(
    tool: ToolName,
    payload: Record<string, unknown>,
    onLog?: (message: string) => void
): Promise<string> {
    // Check built-in tools
    const toolDef = TOOL_DEFINITIONS.find(t => t.name === tool);

    // Check custom tools
    const customToolConfig = CUSTOM_TOOLS.find(t => t.name === (tool as string));

    if ((!toolDef || !toolDef.enabled) && !customToolConfig) {
        throw new Error(`Tool '${tool}' is not enabled or does not exist.`);
    }

    // Handle custom tools
    if (customToolConfig) {
        return executeCustomTool({ toolName: tool, ...payload } as CustomToolPayload, customToolConfig);
    }

    switch (tool) {
        case 'filesystem':
            return executeFilesystem(payload as any as FilesystemPayload);

        case 'github':
            return executeGithub(payload as any as GithubPayload);

        case 'slack':
            return executeSlack(payload as any as SlackPayload);

        case 'calendar':
            return executeCalendar(payload as any as CalendarPayload);

        case 'terminal':
            return executeTerminal(payload as any as TerminalPayload);

        case 'browser':
            // Browser with automatic fallback to search
            try {
                return await executeBrowser(payload as any as BrowserPayload);
            } catch (error) {
                const browserPayload = payload as any as BrowserPayload;
                const url = browserPayload.url;

                if (onLog) {
                    onLog(`[Dispatcher] Browser failed for ${url}, falling back to search...`);
                }
                console.log(`[Dispatcher] Browser fallback: ${error instanceof Error ? error.message : 'Unknown error'}`);

                // Extract meaningful query from URL
                let searchQuery = url;
                try {
                    const parsed = new URL(url);
                    // Use domain + path as search query
                    searchQuery = `${parsed.hostname} ${parsed.pathname.replace(/\//g, ' ')}`.trim();
                } catch {
                    // URL parsing failed, use as-is
                }

                if (onLog) {
                    onLog(`[Dispatcher] Searching for: "${searchQuery}"`);
                }

                // Fallback to search
                const searchResult = await executeSearch({
                    action: 'search',
                    query: searchQuery,
                    limit: 5,
                    deepFetch: true
                }, onLog);

                return `[Fallback from browser to search]\n\n${searchResult}`;
            }

        case 'search':
            return executeSearch(payload as any as SearchPayload, onLog);

        case 'leetcode':
            return executeLeetCode(payload as any as LeetCodePayload);

        case 'mcp_registry':
            return executeMCPRegistry(payload as any as MCPRegistryPayload);

        case 'utility':
            return executeUtility(payload as any as UtilityPayload);

        default:
            throw new Error(`Unknown tool: ${tool}`);
    }
}

/**
 * Dispatch tool with output transformation for chaining
 * Allows the result of one tool to be transformed for the next
 */
export interface ChainedToolResult {
    success: boolean;
    tool: string;
    result: string;
    fallbackUsed?: string;
    transformedForNext?: string;
}

export async function dispatchToolWithChaining(
    tool: ToolName,
    payload: Record<string, unknown>,
    previousResult?: string,
    nextTool?: ToolName,
    onLog?: (message: string) => void
): Promise<ChainedToolResult> {
    // Inject previous result into payload if applicable
    const enrichedPayload = previousResult
        ? { ...payload, previousContext: previousResult }
        : payload;

    try {
        const result = await dispatchTool(tool, enrichedPayload, onLog);
        const fallbackUsed = result.startsWith('[Fallback') ? 'search' : undefined;

        // Transform result for next tool if needed
        let transformedForNext: string | undefined;
        if (nextTool && result) {
            transformedForNext = transformResultForNext(result, tool, nextTool);
        }

        return {
            success: true,
            tool,
            result,
            fallbackUsed,
            transformedForNext
        };
    } catch (error) {
        return {
            success: false,
            tool,
            result: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Transform result from one tool to be suitable for the next tool
 */
function transformResultForNext(result: string, fromTool: ToolName, toTool: ToolName): string {
    // Search/Browser → Filesystem: Extract key content
    if ((fromTool === 'search' || fromTool === 'browser') && toTool === 'filesystem') {
        // Clean up the result for file saving
        return result
            .replace(/🔍|🌐|📋|📄|🔗/g, '') // Remove emojis
            .replace(/\*\*/g, '') // Remove markdown bold
            .substring(0, 10000); // Limit size
    }

    // Search/Browser → Slack: Create summary
    if ((fromTool === 'search' || fromTool === 'browser') && toTool === 'slack') {
        // Create a concise summary for Slack
        const lines = result.split('\n').filter(l => l.trim());
        return lines.slice(0, 10).join('\n');
    }

    // Default: return as-is
    return result;
}
