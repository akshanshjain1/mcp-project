import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface CustomToolPayload {
    toolName: string;
    [key: string]: any;
}

export interface CustomToolConfig {
    name: string;
    description: string;
    type: 'command' | 'http';
    command?: string; // For command type: "python script.py {arg}"
    url?: string;     // For http type: "https://api.example.com/data?q={arg}"
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
}

export async function executeCustomTool(payload: CustomToolPayload, config: CustomToolConfig): Promise<string> {
    const { toolName, ...params } = payload;

    if (config.type === 'command') {
        if (!config.command) throw new Error(`Command not defined for tool ${toolName}`);

        // Replace placeholders like {arg} with actual values
        let cmd = config.command;
        for (const [key, value] of Object.entries(params)) {
            cmd = cmd.replace(`{${key}}`, String(value));
        }

        try {
            const { stdout, stderr } = await execAsync(cmd);
            return stdout || stderr;
        } catch (error: any) {
            throw new Error(`Command failed: ${error.message}`);
        }
    }

    if (config.type === 'http') {
        if (!config.url) throw new Error(`URL not defined for tool ${toolName}`);

        // Replace placeholders in URL
        let url = config.url;
        for (const [key, value] of Object.entries(params)) {
            url = url.replace(`{${key}}`, encodeURIComponent(String(value)));
        }

        const method = config.method || 'GET';
        const headers = config.headers || {};

        try {
            const response = await fetch(url, {
                method,
                headers,
                body: method === 'POST' ? JSON.stringify(params) : undefined
            });

            const text = await response.text();
            return `Status: ${response.status}\nResponse: ${text.substring(0, 2000)}`;
        } catch (error: any) {
            throw new Error(`HTTP request failed: ${error.message}`);
        }
    }

    throw new Error(`Unknown tool type: ${config.type}`);
}
