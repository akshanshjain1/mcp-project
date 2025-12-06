import * as fs from 'fs';
import * as path from 'path';

const SANDBOX_DIR = path.join(__dirname, '..', '..', 'sandbox');

// Ensure sandbox directory exists
function ensureSandbox(): void {
    if (!fs.existsSync(SANDBOX_DIR)) {
        fs.mkdirSync(SANDBOX_DIR, { recursive: true });
    }
}

// Resolve path within sandbox (prevent directory traversal)
function resolveSandboxPath(filePath: string): string {
    ensureSandbox();

    // Normalize the path and ensure it stays within sandbox
    const normalizedPath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(SANDBOX_DIR, normalizedPath);

    // Verify the resolved path is still within sandbox
    if (!fullPath.startsWith(SANDBOX_DIR)) {
        throw new Error('Access denied: Path outside sandbox');
    }

    return fullPath;
}

export interface FilesystemPayload {
    action: 'read' | 'write' | 'list' | 'delete' | 'mkdir';
    path: string;
    content?: string;
}

export async function executeFilesystem(payload: FilesystemPayload): Promise<string> {
    const { action, path: filePath, content } = payload;

    switch (action) {
        case 'read': {
            const fullPath = resolveSandboxPath(filePath);
            if (!fs.existsSync(fullPath)) {
                throw new Error(`File not found: ${filePath}`);
            }
            const data = fs.readFileSync(fullPath, 'utf-8');
            return `File read successfully. Content: ${data.substring(0, 500)}${data.length > 500 ? '...' : ''}`;
        }

        case 'write': {
            if (content === undefined || content === null) {
                throw new Error('Content is required for write action');
            }
            const fullPath = resolveSandboxPath(filePath);
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(fullPath, content, 'utf-8');
            return `File written successfully: ${filePath} (${content.length} characters)`;
        }

        case 'mkdir': {
            const fullPath = resolveSandboxPath(filePath);
            if (fs.existsSync(fullPath)) {
                return `Folder already exists: ${filePath}`;
            }
            fs.mkdirSync(fullPath, { recursive: true });
            return `📁 Folder created successfully: ${filePath}`;
        }

        case 'list': {
            const fullPath = resolveSandboxPath(filePath || '.');
            if (!fs.existsSync(fullPath)) {
                throw new Error(`Directory not found: ${filePath}`);
            }
            const files = fs.readdirSync(fullPath, { withFileTypes: true });
            const listing = files.map(f => `${f.isDirectory() ? '📁' : '📄'} ${f.name}`).join('\n');
            return `Directory listing for ${filePath || '/'}:\n${listing}`;
        }

        case 'delete': {
            const fullPath = resolveSandboxPath(filePath);
            if (!fs.existsSync(fullPath)) {
                throw new Error(`File not found: ${filePath}`);
            }
            fs.unlinkSync(fullPath);
            return `File deleted successfully: ${filePath}`;
        }

        default:
            throw new Error(`Unknown filesystem action: ${action}`);
    }
}
