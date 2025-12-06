export type TaskStatus = 'pending' | 'approved' | 'executing' | 'success' | 'failed';

export type ToolName = 'filesystem' | 'github' | 'slack' | 'calendar' | 'terminal' | 'browser' | 'search' | 'leetcode';

export interface TaskPayload {
    [key: string]: unknown;
}

export interface Task {
    id: string;
    description: string;
    tool: ToolName;
    payload: TaskPayload;
    confidence: number;
    status: TaskStatus;
    result?: string;
    error?: string;
    logs?: string[];
}

export interface Plan {
    id: string;
    summary: string;
    tasks: Task[];
    createdAt: string;
    rawInput: string;
}

export interface ExecuteRequest {
    taskId: string;
    tool: ToolName;
    payload: TaskPayload;
}

export interface ExecuteResponse {
    success: boolean;
    taskId: string;
    result?: string;
    error?: string;
}

export interface AuditEntry {
    id: string;
    type: 'plan' | 'execute' | 'error';
    timestamp: string;
    data: {
        planId?: string;
        taskId?: string;
        tool?: ToolName;
        payload?: TaskPayload;
        result?: string;
        error?: string;
        summary?: string;
        taskCount?: number;
        approved?: boolean;
    };
}

export interface AuditLog {
    entries: AuditEntry[];
}
