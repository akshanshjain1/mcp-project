import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables FIRST before other imports
dotenv.config();

import { generatePlan } from './planner';
import { dispatchTool, getAvailableTools } from './tools/dispatcher';
import { getAuditLog, logTaskExecuted, logError } from './audit';
import { PlanRequestSchema, ExecuteRequestSchema } from './validation';
import { summarizeToolResult } from './groqClient';
import { listMcpDomains, addMcpDomain, removeMcpDomain } from './tools/adapters/browser';

const app = express();
const PORT = process.env.MCP_SERVER_PORT || 3001;

// Middleware
app.use(cors({
    origin: true, // Allow all origins in development, configure specifically for production
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        tools: getAvailableTools(),
    });
});

// Generate plan from text
app.post('/api/plan', async (req, res) => {
    try {
        // Validate request
        const parsed = PlanRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Invalid request',
                details: parsed.error.errors,
            });
        }

        const { text } = parsed.data;

        // Check for API key
        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({
                error: 'GROQ_API_KEY not configured. Please add it to .env file.',
            });
        }

        // Generate plan
        const plan = await generatePlan(text);

        return res.json(plan);
    } catch (error) {
        console.error('Plan generation error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to generate plan',
        });
    }
});

// Execute a single task
app.post('/api/execute', async (req, res) => {
    try {
        // Validate request
        const parsed = ExecuteRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Invalid request',
                details: parsed.error.errors,
            });
        }

        const { taskId, tool, payload } = parsed.data;
        const taskDescription = req.body.description || 'Execute task';

        // Execute the tool
        const rawResult = await dispatchTool(tool, payload);

        // Summarize result using LLM for human-readable output
        let summarizedResult: string;
        try {
            summarizedResult = await summarizeToolResult(taskDescription, tool, rawResult);
        } catch (summarizeError) {
            console.error('Summarization failed, using raw result:', summarizeError);
            summarizedResult = rawResult;
        }

        // Log successful execution
        logTaskExecuted(taskId, tool, payload, summarizedResult, true);

        return res.json({
            success: true,
            taskId,
            result: summarizedResult,
            rawResult: rawResult, // Include raw result for debugging
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Execution failed';

        // Log error
        const { taskId, tool } = req.body;
        logError(taskId, tool, errorMessage);

        return res.status(500).json({
            success: false,
            taskId: req.body.taskId,
            error: errorMessage,
        });
    }
});

import { streamSummarizeToolResult } from './groqClient';

// Stream execute a single task (SSE)
app.get('/api/stream-execute', async (req, res) => {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (event: string, data: any) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
        // Parse query params (GET request for SSE)
        const taskId = req.query.taskId as string;
        const tool = req.query.tool as any;
        const payloadStr = req.query.payload as string;
        const description = req.query.description as string || 'Execute task';

        if (!taskId || !tool || !payloadStr) {
            sendEvent('error', { message: 'Missing required parameters' });
            res.end();
            return;
        }

        let payload;
        try {
            payload = JSON.parse(payloadStr);
        } catch (e) {
            sendEvent('error', { message: 'Invalid payload JSON' });
            res.end();
            return;
        }

        // 1. Start execution
        sendEvent('start', { taskId, tool });

        const onLog = (message: string) => {
            sendEvent('log', { message });
        };

        // 2. Execute tool
        const rawResult = await dispatchTool(tool, payload, onLog);
        sendEvent('tool_result', { rawResult });

        // 3. Stream LLM summary
        try {
            const stream = await streamSummarizeToolResult(description, tool, rawResult);

            let fullSummary = '';
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    fullSummary += content;
                    sendEvent('summary_chunk', { content });
                }
            }

            // Log successful execution
            logTaskExecuted(taskId, tool, payload, fullSummary, true);
            sendEvent('done', { result: fullSummary });

        } catch (summarizeError) {
            console.error('Streaming summarization failed:', summarizeError);
            // Fallback to raw result if LLM fails
            sendEvent('summary_chunk', { content: rawResult });
            sendEvent('done', { result: rawResult });
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Execution failed';
        console.error('Stream execution error:', error);
        sendEvent('error', { message: errorMessage });
    }

    res.end();
});

// Get audit log (only available if audit is enabled)
if (process.env.AUDIT_ENABLED === 'true') {
    app.get('/api/audit', (_req, res) => {
        try {
            const log = getAuditLog();
            return res.json(log);
        } catch (error) {
            console.error('Audit log error:', error);
            return res.status(500).json({
                error: 'Failed to retrieve audit log',
            });
        }
    });
}

// Get available tools
app.get('/api/tools', (_req, res) => {
    res.json({
        tools: getAvailableTools(),
    });
});

// List allowed MCP servers
app.get('/api/mcp_servers', (_req, res) => {
    res.json({ domains: listMcpDomains() });
});

// Add allowed MCP server
app.post('/api/mcp_servers', (req, res) => {
    const { domain } = req.body;
    if (!domain || typeof domain !== 'string') {
        return res.status(400).json({ error: 'Invalid domain' });
    }
    addMcpDomain(domain);
    res.json({ success: true, domains: listMcpDomains() });
});

// Remove MCP server
app.delete('/api/mcp_servers', (req, res) => {
    const { domain } = req.body;
    if (!domain || typeof domain !== 'string') {
        return res.status(400).json({ error: 'Invalid domain' });
    }
    removeMcpDomain(domain);
    res.json({ success: true, domains: listMcpDomains() });
});

// Start server
app.listen(PORT, () => {
    const auditEnabled = process.env.AUDIT_ENABLED === 'true';
    const auditLine = auditEnabled
        ? '║   • GET  /api/audit   → View audit history                 ║'
        : '║   • Audit logging: DISABLED (set AUDIT_ENABLED=true)     ║';

    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🤖 MCP Server v1.0                                       ║
║   ─────────────────────────────────────────────────────    ║
║   Server running on http://localhost:${PORT}                   ║
║                                                            ║
║   Endpoints:                                               ║
║   • POST /api/plan    → Generate execution plan            ║
║   • POST /api/execute → Execute approved task              ║
${auditLine}
║   • GET  /api/tools   → List available tools               ║
║   • GET  /api/health  → Health check                       ║
║                                                            ║
║   Safe Mode: ENABLED 🛡️                                    ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);

    // Log tool status
    console.log('Available tools:');
    getAvailableTools().forEach(tool => {
        const status = tool.enabled ? '✅' : '❌';
        console.log(`  ${status} ${tool.name}: ${tool.description}`);
    });
    console.log('');
});
