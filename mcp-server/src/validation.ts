import { z } from 'zod';

// Tool names
// Tool names
export const ToolNameSchema = z.string();
export type ToolName = z.infer<typeof ToolNameSchema>;

// Task status
export const TaskStatusSchema = z.enum([
    'pending',
    'approved',
    'executing',
    'success',
    'failed',
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

// Task schema
export const TaskSchema = z.object({
    id: z.string(),
    description: z.string(),
    tool: ToolNameSchema,
    payload: z.record(z.unknown()),
    confidence: z.number().min(0).max(1),
    status: TaskStatusSchema,
    result: z.string().optional(),
    error: z.string().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

// Plan schema
export const PlanSchema = z.object({
    id: z.string(),
    summary: z.string(),
    tasks: z.array(TaskSchema),
    createdAt: z.string(),
    rawInput: z.string(),
});
export type Plan = z.infer<typeof PlanSchema>;

// Execute request schema
export const ExecuteRequestSchema = z.object({
    taskId: z.string(),
    tool: ToolNameSchema,
    payload: z.record(z.unknown()),
});
export type ExecuteRequest = z.infer<typeof ExecuteRequestSchema>;

// Execute response schema
export const ExecuteResponseSchema = z.object({
    success: z.boolean(),
    taskId: z.string(),
    result: z.string().optional(),
    error: z.string().optional(),
});
export type ExecuteResponse = z.infer<typeof ExecuteResponseSchema>;

// LLM output schema for task extraction
export const LLMTaskOutputSchema = z.object({
    summary: z.string(),
    tasks: z.array(z.object({
        description: z.string(),
        tool: ToolNameSchema,
        payload: z.record(z.unknown()),
        confidence: z.number().min(0).max(1),
    })),
});
export type LLMTaskOutput = z.infer<typeof LLMTaskOutputSchema>;

// Audit entry schema
export const AuditEntryTypeSchema = z.enum(['plan', 'execute', 'error']);
export type AuditEntryType = z.infer<typeof AuditEntryTypeSchema>;

export const AuditEntrySchema = z.object({
    id: z.string(),
    type: AuditEntryTypeSchema,
    timestamp: z.string(),
    data: z.object({
        planId: z.string().optional(),
        taskId: z.string().optional(),
        tool: ToolNameSchema.optional(),
        payload: z.record(z.unknown()).optional(),
        result: z.string().optional(),
        error: z.string().optional(),
        summary: z.string().optional(),
        taskCount: z.number().optional(),
        approved: z.boolean().optional(),
    }),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

// Audit log schema
export const AuditLogSchema = z.object({
    entries: z.array(AuditEntrySchema),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

// Plan request schema
export const PlanRequestSchema = z.object({
    text: z.string().min(1, 'Text input is required'),
});
export type PlanRequest = z.infer<typeof PlanRequestSchema>;
