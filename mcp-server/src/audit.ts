import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AuditEntry, AuditLog, AuditEntryType, ToolName } from './validation';

// Disable audit logging in production by default
const AUDIT_ENABLED = process.env.AUDIT_ENABLED === 'true';
const AUDIT_DIR = path.join(__dirname, '..', 'audit');
const AUDIT_FILE = path.join(AUDIT_DIR, 'log.json');

// Ensure audit directory exists (only if audit is enabled)
function ensureAuditDir(): void {
    if (!AUDIT_ENABLED) return;

    if (!fs.existsSync(AUDIT_DIR)) {
        fs.mkdirSync(AUDIT_DIR, { recursive: true });
    }
}

// Load audit log (return empty if audit is disabled)
function loadAuditLog(): AuditLog {
    if (!AUDIT_ENABLED) return { entries: [] };

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

// Save audit log (no-op if audit is disabled)
function saveAuditLog(log: AuditLog): void {
    if (!AUDIT_ENABLED) return;

    ensureAuditDir();
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(log, null, 2), 'utf-8');
}

// Add audit entry (only if audit is enabled)
function addEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    if (!AUDIT_ENABLED) {
        // Return a dummy entry if audit is disabled
        return {
            id: 'audit-disabled',
            timestamp: new Date().toISOString(),
            type: entry.type,
            data: entry.data,
        };
    }

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

// Log a plan generation (no-op if audit disabled)
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

// Log task execution (no-op if audit disabled)
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

// Log error (no-op if audit disabled)
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

// Get audit entries (returns empty if audit disabled)
export function getAuditLog(): AuditLog {
    return loadAuditLog();
}

// Clear audit log (no-op if audit disabled)
export function clearAuditLog(): void {
    saveAuditLog({ entries: [] });
}
