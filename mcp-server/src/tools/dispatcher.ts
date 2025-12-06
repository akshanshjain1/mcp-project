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
        description: 'Read, write, list, delete files, and create folders (mkdir) in the sandbox directory',
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
            return executeBrowser(payload as any as BrowserPayload);

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
