import { v4 as uuidv4 } from 'uuid';
import { Plan, Task } from './validation';
import { analyzePlan as extractTasksFromText } from './groqClient';
import { logPlanGenerated } from './audit';

export async function generatePlan(text: string): Promise<Plan> {
    // Extract tasks using Groq LLM
    const llmOutput = await extractTasksFromText(text);

    // Generate plan ID
    const planId = uuidv4();

    // Convert LLM output to Plan format with IDs and status
    const tasks: Task[] = llmOutput.tasks.map((task, index) => ({
        id: `${planId}-task-${index + 1}`,
        description: task.description,
        tool: task.tool,
        payload: task.payload,
        confidence: task.confidence,
        status: 'pending' as const,
    }));

    const plan: Plan = {
        id: planId,
        summary: llmOutput.summary,
        tasks,
        createdAt: new Date().toISOString(),
        rawInput: text,
    };

    // Log to audit
    logPlanGenerated(plan.id, plan.summary, plan.tasks.length);

    return plan;
}
