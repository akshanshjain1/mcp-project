export interface MCPRegistryPayload {
    action: 'search' | 'list_popular';
    query?: string;
}

interface MCPServer {
    name: string;
    description: string;
    command: string;
    url?: string;
}

const POPULAR_MCPS: MCPServer[] = [
    {
        name: 'sqlite',
        description: 'SQLite database interaction',
        command: 'npx -y @modelcontextprotocol/server-sqlite',
        url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite'
    },
    {
        name: 'postgres',
        description: 'PostgreSQL database interaction',
        command: 'npx -y @modelcontextprotocol/server-postgres',
        url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres'
    },
    {
        name: 'filesystem',
        description: 'Secure filesystem access',
        command: 'npx -y @modelcontextprotocol/server-filesystem',
        url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem'
    },
    {
        name: 'github',
        description: 'GitHub API integration',
        command: 'npx -y @modelcontextprotocol/server-github',
        url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github'
    },
    {
        name: 'brave-search',
        description: 'Web search using Brave',
        command: 'npx -y @modelcontextprotocol/server-brave-search',
        url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search'
    },
    {
        name: 'google-maps',
        description: 'Google Maps integration',
        command: 'npx -y @modelcontextprotocol/server-google-maps',
        url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/google-maps'
    }
];

export async function executeMCPRegistry(payload: MCPRegistryPayload): Promise<string> {
    const { action, query } = payload;

    switch (action) {
        case 'list_popular':
            return formatMCPList(POPULAR_MCPS, 'Popular MCP Servers');

        case 'search':
            if (!query) {
                return '❌ Please provide a search query';
            }
            const results = POPULAR_MCPS.filter(mcp =>
                mcp.name.toLowerCase().includes(query.toLowerCase()) ||
                mcp.description.toLowerCase().includes(query.toLowerCase())
            );

            if (results.length === 0) {
                return `No MCP servers found for "${query}".\n\nTry searching on https://smithery.ai or https://glama.ai/mcp/servers`;
            }

            return formatMCPList(results, `Search results for "${query}"`);

        default:
            return `❌ Unknown action: ${action}`;
    }
}

function formatMCPList(mcps: MCPServer[], title: string): string {
    let output = `📦 **${title}**\n\n`;

    mcps.forEach(mcp => {
        output += `### ${mcp.name}\n`;
        output += `📝 ${mcp.description}\n`;
        output += `💻 Command: \`${mcp.command}\`\n`;
        if (mcp.url) output += `🔗 [Source](${mcp.url})\n`;
        output += '\n---\n\n';
    });

    output += `\n💡 **Tip**: You can find more MCP servers at [smithery.ai](https://smithery.ai) or [glama.ai](https://glama.ai/mcp/servers).`;

    return output;
}
