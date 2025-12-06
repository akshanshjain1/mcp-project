import { Plan, ExecuteRequest, AuditLog } from '../lib/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export interface ExecuteRequestWithDescription extends ExecuteRequest {
    description?: string;
}

export async function analyzePlan(text: string): Promise<Plan> {
    const response = await fetch(`${API_BASE}/plan`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to analyze text' }));
        throw new Error(error.message || 'Failed to analyze text');
    }

    return response.json();
}



export type StreamEvent =
    | { type: 'start', data: { taskId: string, tool: string } }
    | { type: 'log', data: { message: string } }
    | { type: 'tool_result', data: { rawResult: string } }
    | { type: 'summary_chunk', data: { content: string } }
    | { type: 'done', data: { result: string } }
    | { type: 'error', data: { message: string } };

export function streamExecuteTask(
    request: ExecuteRequestWithDescription,
    onEvent: (event: StreamEvent) => void
): () => void {
    const params = new URLSearchParams({
        taskId: request.taskId,
        tool: request.tool,
        payload: JSON.stringify(request.payload),
        description: request.description || ''
    });

    const eventSource = new EventSource(`${API_BASE}/stream-execute?${params.toString()}`);

    eventSource.addEventListener('start', (e) => {
        onEvent({ type: 'start', data: JSON.parse(e.data) });
    });

    eventSource.addEventListener('log', (e) => {
        onEvent({ type: 'log', data: JSON.parse(e.data) });
    });

    eventSource.addEventListener('tool_result', (e) => {
        onEvent({ type: 'tool_result', data: JSON.parse(e.data) });
    });

    eventSource.addEventListener('summary_chunk', (e) => {
        onEvent({ type: 'summary_chunk', data: JSON.parse(e.data) });
    });

    eventSource.addEventListener('done', (e) => {
        onEvent({ type: 'done', data: JSON.parse(e.data) });
        eventSource.close();
    });

    eventSource.addEventListener('error', (e) => {
        let message = 'Stream connection error';
        try {
            const data = JSON.parse((e as MessageEvent).data);
            if (data && data.message) message = data.message;
        } catch { }

        onEvent({ type: 'error', data: { message } });
        eventSource.close();
    });

    return () => {
        eventSource.close();
    };
}

export async function getAuditLog(): Promise<AuditLog> {
    const response = await fetch(`${API_BASE}/audit`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch audit log' }));
        throw new Error(error.message || 'Failed to fetch audit log');
    }

    return response.json();
}

export async function getMcpServers(): Promise<string[]> {
    const response = await fetch(`${API_BASE}/mcp_servers`);
    if (!response.ok) throw new Error('Failed to get MCP servers');
    const data = await response.json();
    return data.domains || [];
}

export async function addMcpServer(domain: string): Promise<string[]> {
    const response = await fetch(`${API_BASE}/mcp_servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
    });
    if (!response.ok) throw new Error('Failed to add MCP server');
    const data = await response.json();
    return data.domains || [];
}

export async function removeMcpServer(domain: string): Promise<string[]> {
    const response = await fetch(`${API_BASE}/mcp_servers`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
    });
    if (!response.ok) throw new Error('Failed to remove MCP server');
    const data = await response.json();
    return data.domains || [];
}