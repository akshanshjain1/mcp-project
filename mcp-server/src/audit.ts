import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AuditEntry, AuditLog, AuditEntryType, ToolName } from './validation';

const AUDIT_DIR = path.join(__dirname, '..', 'audit');
const AUDIT_FILE = path.join(AUDIT_DIR, 'log.json');

// Ensure audit directory exists
function ensureAuditDir(): void {
    if (!fs.existsSync(AUDIT_DIR)) {
        fs.mkdirSync(AUDIT_DIR, { recursive: true });
    }
}

// Load audit log
function loadAuditLog(): AuditLog {
    ensureAuditDir();

    if (!fs.existsSync(AUDIT_FILE)) {
        return { entries: [] };
    }

    try {
        const content = fs.readFileSync(AUDIT_FILE, 'utf-8');
        return JSON.parse(content) as AuditLog;
    } catch {
        return { entries: [] };
    }
}

// Save audit log
function saveAuditLog(log: AuditLog): void {
    ensureAuditDir();
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(log, null, 2), 'utf-8');
}

// Add audit entry
function addEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    const log = loadAuditLog();

    const newEntry: AuditEntry = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        type: entry.type,
        data: entry.data,
    };

    log.entries.push(newEntry);

    // Keep only last 100 entries
    if (log.entries.length > 100) {
        log.entries = log.entries.slice(-100);
    }

    saveAuditLog(log);
    return newEntry;
}

// Log a plan generation
export function logPlanGenerated(planId: string, summary: string, taskCount: number): AuditEntry {
    return addEntry({
        type: 'plan' as AuditEntryType,
        data: {
            planId,
            summary,
            taskCount,
        },
    });
}

// Log task execution
export function logTaskExecuted(
    taskId: string,
    tool: ToolName,
    payload: Record<string, unknown>,
    result: string,
    approved: boolean
): AuditEntry {
    return addEntry({
        type: 'execute' as AuditEntryType,
        data: {
            taskId,
            tool,
            payload,
            result,
            approved,
        },
    });
}

// Log error
export function logError(
    taskId: string | undefined,
    tool: ToolName | undefined,
    error: string
): AuditEntry {
    return addEntry({
        type: 'error' as AuditEntryType,
        data: {
            taskId,
            tool,
            error,
        },
    });
}

// Get audit entries
export function getAuditLog(): AuditLog {
    return loadAuditLog();
}

// Clear audit log
export function clearAuditLog(): void {
    saveAuditLog({ entries: [] });
}
