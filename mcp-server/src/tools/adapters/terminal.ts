import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Whitelist of allowed commands (for safety)
const ALLOWED_COMMANDS = [
    'echo',
    'date',
    'pwd',
    'whoami',
    'ls',
    'dir',
    'cat',
    'type',
    'head',
    'tail',
    'wc',
    'grep',
    'find',
    'node',
    'npm',
    'npx',
    'git',
];

export interface TerminalPayload {
    action: 'execute';
    command: string;
    args?: string[];
}

export async function executeTerminal(payload: TerminalPayload): Promise<string> {
    const { command, args = [] } = payload;

    // Check if terminal is enabled
    if (process.env.ALLOW_TERMINAL !== 'true') {
        throw new Error('Terminal adapter is disabled. Set ALLOW_TERMINAL=true in .env to enable.');
    }

    // Validate command is in whitelist
    const baseCommand = command.toLowerCase();
    if (!ALLOWED_COMMANDS.includes(baseCommand)) {
        throw new Error(`Command not allowed: ${command}. Allowed commands: ${ALLOWED_COMMANDS.join(', ')}`);
    }

    // Sanitize arguments to prevent injection
    const sanitizedArgs = args.map(arg => {
        // Remove potentially dangerous characters
        if (arg.includes(';') || arg.includes('|') || arg.includes('&') || arg.includes('`')) {
            throw new Error('Invalid characters in arguments');
        }
        // Escape quotes for shell
        return `"${arg.replace(/"/g, '\\"')}"`;
    });

    const fullCommand = [command, ...sanitizedArgs].join(' ');

    try {
        const { stdout, stderr } = await execAsync(fullCommand, {
            timeout: 30000, // 30 second timeout
            maxBuffer: 1024 * 1024, // 1MB max output
        });

        const output = stdout || stderr;
        return `Command executed: ${fullCommand}\n\nOutput:\n${output.substring(0, 2000)}${output.length > 2000 ? '\n...(truncated)' : ''}`;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Command failed: ${error.message}`);
        }
        throw error;
    }
}
