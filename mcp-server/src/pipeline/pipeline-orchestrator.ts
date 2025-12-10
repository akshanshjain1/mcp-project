/**
 * Pipeline Orchestrator - Perplexity-style Sequential Execution
 * 
 * Executes a 6-stage pipeline:
 * 1. Query Parsing - Understand intent and decompose
 * 2. Model Selection - Pick appropriate model/prompt
 * 3. Search Retrieval - Multi-source search
 * 4. Refinement - Deduplicate, rank, verify
 * 5. Generation - LLM synthesis with context
 * 6. Citation - Add inline citations
 */

import { Task } from '../validation';

export type PipelineStage =
    | 'idle'
    | 'query_parsing'
    | 'tool_selection'
    | 'executing'
    | 'summarizing'
    | 'complete'
    | 'failed';

export type QueryIntent =
    | 'factual'         // Facts, definitions, "what is X"
    | 'comparison'      // "X vs Y", "compare"
    | 'research'        // Deep research, analysis
    | 'real_time'       // Weather, stocks, current data
    | 'action'          // Create file, send message
    | 'calculation'     // Math, conversions
    | 'creative'        // Generate content
    | 'general';        // General queries

export interface PipelineContext {
    originalQuery: string;
    intent: QueryIntent;
    decomposedQueries: string[];
    selectedTool: string;
    taskResults: TaskResult[];
    finalAnswer: string;
    citations: Citation[];
    stage: PipelineStage;
    progress: number;
    startTime: number;
    endTime?: number;
}

export interface TaskResult {
    taskId: string;
    tool: string;
    rawResult: string;
    summary?: string;
    success: boolean;
    error?: string;
}

export interface Citation {
    index: number;
    title: string;
    url: string;
    snippet?: string;
}

export interface PipelineEvent {
    type: 'stage_change' | 'progress' | 'task_start' | 'task_complete' | 'chunk' | 'error' | 'complete';
    stage?: PipelineStage;
    progress?: number;
    data?: any;
    message?: string;
}

/**
 * Detect query intent from user question
 */
export function detectIntent(query: string): QueryIntent {
    const lowerQuery = query.toLowerCase();

    // Comparison queries
    if (lowerQuery.includes(' vs ') ||
        lowerQuery.includes('versus') ||
        lowerQuery.includes('compare') ||
        lowerQuery.includes('difference between') ||
        lowerQuery.includes('better than')) {
        return 'comparison';
    }

    // Real-time data queries
    if (lowerQuery.includes('weather') ||
        lowerQuery.includes('stock price') ||
        lowerQuery.includes('current') ||
        lowerQuery.includes('today') ||
        lowerQuery.includes('right now') ||
        lowerQuery.includes('live')) {
        return 'real_time';
    }

    // Calculation queries
    if (lowerQuery.match(/\d+\s*[\+\-\*\/]\s*\d+/) ||
        lowerQuery.includes('calculate') ||
        lowerQuery.includes('convert') ||
        lowerQuery.includes('how much is') ||
        lowerQuery.includes('currency')) {
        return 'calculation';
    }

    // Action queries
    if (lowerQuery.includes('create') ||
        lowerQuery.includes('write') ||
        lowerQuery.includes('send') ||
        lowerQuery.includes('schedule') ||
        lowerQuery.includes('delete') ||
        lowerQuery.includes('make a file')) {
        return 'action';
    }

    // Factual queries
    if (lowerQuery.startsWith('what is') ||
        lowerQuery.startsWith('who is') ||
        lowerQuery.startsWith('when did') ||
        lowerQuery.startsWith('where is') ||
        lowerQuery.startsWith('define') ||
        lowerQuery.includes('meaning of')) {
        return 'factual';
    }

    // Research queries
    if (lowerQuery.includes('explain') ||
        lowerQuery.includes('how does') ||
        lowerQuery.includes('why is') ||
        lowerQuery.includes('research') ||
        lowerQuery.includes('analysis') ||
        lowerQuery.includes('in depth') ||
        lowerQuery.length > 100) {
        return 'research';
    }

    // Creative queries
    if (lowerQuery.includes('generate') ||
        lowerQuery.includes('write me') ||
        lowerQuery.includes('create a story') ||
        lowerQuery.includes('poem') ||
        lowerQuery.includes('creative')) {
        return 'creative';
    }

    return 'general';
}

/**
 * Get the appropriate system prompt based on intent
 */
export function getIntentPrompt(intent: QueryIntent, originalQuery: string): string {
    const baseContext = `
ORIGINAL USER QUESTION: "${originalQuery}"

You must answer the above question directly and comprehensively.
`;

    const prompts: Record<QueryIntent, string> = {
        factual: `${baseContext}
You are a FACTUAL KNOWLEDGE EXPERT. The user is asking for specific facts or definitions.

RESPONSE GUIDELINES:
- Start with a clear, direct answer to the question
- Provide factual, verified information only
- Use bullet points for multiple facts
- Include dates, numbers, and specific details where relevant
- Cite sources inline [1], [2] after each fact
- Keep the response focused and concise
- If the data doesn't contain the answer, say so clearly`,

        comparison: `${baseContext}
You are a COMPARISON ANALYST. The user wants to understand differences or similarities.

RESPONSE GUIDELINES:
- Start with a brief overview of both subjects
- Create a comparison table with key differences
- Highlight pros and cons of each
- Provide a clear recommendation if asked
- Use data and statistics to support comparisons
- Cite sources for each claim [1], [2]
- End with a summary of key takeaways`,

        research: `${baseContext}
You are a RESEARCH ANALYST providing in-depth analysis.

RESPONSE GUIDELINES:
- Start with an executive summary (2-3 paragraphs)
- Break down complex topics into sections
- Include quantitative data where available
- Discuss multiple perspectives
- Provide context and background
- Use headers to organize information
- Cite all claims with sources [1], [2]
- End with actionable insights or conclusions`,

        real_time: `${baseContext}
You are a REAL-TIME DATA REPORTER.

RESPONSE GUIDELINES:
- Present the current/live data clearly
- Include timestamp if available
- Provide context for the numbers
- Compare to historical data if available
- Keep the response concise and scannable
- Note any limitations or data freshness issues`,

        action: `${baseContext}
You are a TASK EXECUTION ASSISTANT confirming completed actions.

RESPONSE GUIDELINES:
- Confirm what action was taken
- Provide details of the result
- Include any relevant identifiers (file paths, IDs, etc.)
- Suggest next steps if applicable
- Be concise and action-oriented`,

        calculation: `${baseContext}
You are a CALCULATION ASSISTANT.

RESPONSE GUIDELINES:
- Show the calculation clearly
- Provide the final result prominently
- Include the formula or method used
- Add context or explanation if needed
- For conversions, show both values clearly`,

        creative: `${baseContext}
You are a CREATIVE CONTENT GENERATOR.

RESPONSE GUIDELINES:
- Be creative and engaging
- Match the requested tone and style
- Provide complete, polished content
- Include structure (paragraphs, sections) as needed
- Avoid generic or templated responses`,

        general: `${baseContext}
You are a COMPREHENSIVE AI ASSISTANT.

RESPONSE GUIDELINES:
- Provide a helpful, complete answer
- Use appropriate formatting (bullets, headers)
- Be informative but concise
- Cite sources where applicable [1], [2]
- Anticipate follow-up questions`,
    };

    return prompts[intent] || prompts.general;
}

/**
 * Decompose complex queries into sub-queries
 */
export function decomposeQuery(query: string, intent: QueryIntent): string[] {
    const queries: string[] = [query];

    // For comparison queries, separate the subjects
    if (intent === 'comparison') {
        const vsMatch = query.match(/(.+?)\s+(?:vs\.?|versus|compared to|or)\s+(.+)/i);
        if (vsMatch) {
            const [, subject1, subject2] = vsMatch;
            queries.push(`${subject1.trim()} features benefits pros cons`);
            queries.push(`${subject2.trim()} features benefits pros cons`);
        }
    }

    // For research queries, add related sub-queries
    if (intent === 'research') {
        queries.push(`${query} recent developments 2024`);
        queries.push(`${query} expert analysis`);
    }

    return queries;
}

/**
 * Extract citations from sources
 */
export function extractCitations(sources: Array<{ title: string; url: string; snippet?: string }>): Citation[] {
    return sources.map((source, index) => ({
        index: index + 1,
        title: source.title,
        url: source.url,
        snippet: source.snippet,
    }));
}

/**
 * Format citations for display
 */
export function formatCitations(citations: Citation[]): string {
    if (citations.length === 0) return '';

    return '\n\n📚 **Sources:**\n' +
        citations.map(c => `[${c.index}] ${c.title} - ${c.url}`).join('\n');
}

/**
 * Create initial pipeline context
 */
export function createPipelineContext(query: string): PipelineContext {
    const intent = detectIntent(query);
    return {
        originalQuery: query,
        intent,
        decomposedQueries: decomposeQuery(query, intent),
        selectedTool: '',
        taskResults: [],
        finalAnswer: '',
        citations: [],
        stage: 'idle',
        progress: 0,
        startTime: Date.now(),
    };
}

/**
 * Update pipeline stage
 */
export function updateStage(context: PipelineContext, stage: PipelineStage, progress: number): PipelineContext {
    return {
        ...context,
        stage,
        progress,
        endTime: stage === 'complete' || stage === 'failed' ? Date.now() : undefined,
    };
}
