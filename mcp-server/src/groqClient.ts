
import Groq from 'groq-sdk';
import { z } from 'zod';
import { TaskSchema, type Task } from './validation';
import { getAvailableTools } from './tools/dispatcher';

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const FEW_SHOT_EXAMPLE = `Example Input:
"Please create a file called meeting-notes.md and send a message to #team-updates about the new feature"

Example Output:
{
  "summary": "Create a meeting notes file and notify the team about a new feature",
  "tasks": [
    {
      "description": "Create a new file called meeting-notes.md",
      "tool": "filesystem",
      "payload": {
        "action": "write",
        "path": "meeting-notes.md",
        "content": "# Meeting Notes\\n\\n## Date: Today\\n\\n## Attendees\\n\\n## Agenda\\n\\n## Notes\\n\\n## Action Items"
      },
      "confidence": 0.95
    },
    {
      "description": "Send a message to #team-updates about the new feature",
      "tool": "slack",
      "payload": {
        "action": "send_message",
        "channel": "#team-updates",
        "message": "🚀 New Feature Update: We've just completed a new feature. Check out the details in the meeting notes!"
      },
      "confidence": 0.9
    }
  ]
}`;

// LLM response schema
const LLMResponseSchema = z.object({
  summary: z.string(),
  tasks: z.array(z.object({
    description: z.string(),
    tool: z.string(), // Allow any tool name for flexibility
    payload: z.record(z.unknown()),
    confidence: z.number().min(0).max(1),
  })),
});

export type PlanResponse = {
  summary: string;
  tasks: Task[];
};

// Model configuration
const PRIMARY_MODEL = 'openai/gpt-oss-120b';
const FALLBACK_MODEL = 'llama-3.3-70b-versatile';

/**
 * Helper to create chat completion with fallback strategy
 */
async function createChatCompletion(params: any) {
  try {
    console.log(`[LLM] Trying primary model: ${PRIMARY_MODEL}`);
    return await groq.chat.completions.create({
      ...params,
      model: PRIMARY_MODEL,
    });
  } catch (error) {
    console.warn(`[LLM] Primary model failed, switching to fallback: ${FALLBACK_MODEL}`, error);
    return await groq.chat.completions.create({
      ...params,
      model: FALLBACK_MODEL,
    });
  }
}

/**
 * Analyze a user request and generate an execution plan
 */
export async function analyzePlan(userRequest: string): Promise<PlanResponse> {
  const availableTools = getAvailableTools();

  const SYSTEM_PROMPT = `You are a PERPLEXITY-STYLE AI that creates SEQUENTIAL EXECUTION PLANS with proper tool chaining.

AVAILABLE TOOLS:
${availableTools.map(t => `🔧 **${t.name.toUpperCase()}**: ${t.description}`).join('\n')}

=== SEQUENTIAL CHAIN PLANNING ===

🔗 **CREATE MULTI-STEP CHAINS when query has multiple parts:**

Example queries that NEED multiple tasks:
- "Search for X and translate to Hindi" → Task 1: search, Task 2: utility (translate)
- "Find info about Y and save to file" → Task 1: search, Task 2: filesystem
- "Get weather and schedule reminder" → Task 1: utility (weather), Task 2: calendar
- "Fetch URL and summarize in Spanish" → Task 1: browser, Task 2: utility (translate)

**CRITICAL: Output of Task 1 is AUTOMATICALLY passed to Task 2!**
You just need to describe what each task does - the system handles chaining.

=== CHAIN DETECTION KEYWORDS ===

When you see these words, CREATE MULTIPLE TASKS:
- "and then", "then", "after that" → Chain tasks sequentially
- "translate", "in hindi/spanish/etc" → Add utility translate task
- "save", "store", "write" → Add filesystem task after data gathering
- "schedule", "remind" → Add calendar task
- "summarize and share" → Add slack task after summary

=== SINGLE TASK QUERIES ===

Use ONE task only when:
- Simple question: "What is AI?" → search only
- Quick data: "Weather in Tokyo" → utility only
- Single action: "Create a file" → filesystem only

=== TOOL GUIDE ===

**SEARCH** - Get information from web
- Facts, news, companies, research
- "What is Nutanix?" "Latest AI news"

**UTILITY** - Quick operations + TRANSLATION
- translate: Translate text to any language (IMPORTANT!)
- weather: Get current weather
- currency/convert_currency: Currency conversion
- math: Calculations
- time: Current time in locations
- crypto: Cryptocurrency prices

**BROWSER** - Fetch specific URL content
- Only when user provides URL

**FILESYSTEM** - Local file operations

**CALENDAR** - Schedule events

=== OUTPUT FORMAT ===

Return JSON with tasks in execution order:

{
  "summary": "I'll search for Nutanix info and then translate to Hindi",
  "tasks": [
    {
      "description": "Search for Nutanix company information",
      "tool": "search",
      "payload": { "action": "search", "query": "Nutanix company overview" },
      "confidence": 0.9
    },
    {
      "description": "Translate the search results to Hindi",
      "tool": "utility",
      "payload": { "action": "translate", "text": "[WILL USE PREVIOUS RESULT]", "target": "hi" },
      "confidence": 0.85
    }
  ]
}

=== LANGUAGE CODES ===
hi=Hindi, es=Spanish, fr=French, de=German, zh=Chinese, ja=Japanese, ko=Korean, ar=Arabic, ru=Russian, pt=Portuguese

REMEMBER:
- Multi-step queries NEED multiple tasks
- Translation is a SEPARATE task using utility tool
- Tasks execute SEQUENTIALLY - output chains automatically`;

  const response = await createChatCompletion({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: FEW_SHOT_EXAMPLE },
      { role: 'user', content: userRequest },
    ],
    temperature: 0.3, // Lower temperature for more focused, accurate planning
    max_tokens: 4000, // Increased for more detailed plans
    response_format: { type: 'json_object' },
  }) as any; // Cast because createChatCompletion returns a union or generic

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from LLM');
  }

  // Parse and validate the response
  const parsed = JSON.parse(content);
  const validated = LLMResponseSchema.parse(parsed);

  // Add unique IDs and status to tasks
  const tasksWithIds: Task[] = validated.tasks.map((task, index) => ({
    ...task,
    id: `task-${Date.now()}-${index}`,
    status: 'pending' as const,
  }));

  return {
    summary: validated.summary,
    tasks: tasksWithIds,
  };
}

/**
 * Summarize tool results with DETAILED response like ChatGPT
 * - Uses intent-based prompts for better answers
 * - Includes original user query for context
 * - Produces comprehensive, well-structured answers
 * - Includes inline citations [1], [2]
 */
export async function summarizeToolResult(
  taskDescription: string,
  toolName: string,
  rawResult: string,
  userQuery?: string
): Promise<string> {
  const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  // Import intent detection (inline to avoid circular deps)
  const { detectIntent, getIntentPrompt } = await import('./pipeline/pipeline-orchestrator');

  // Detect intent from original query or task description
  const queryForIntent = userQuery || taskDescription;
  const intent = detectIntent(queryForIntent);
  const intentPrompt = getIntentPrompt(intent, queryForIntent);

  console.log(`[LLM Summary] Intent detected: ${intent}`);

  // Always give detailed responses for search/comparison queries
  const isComparison = intent === 'comparison' ||
    taskDescription.toLowerCase().includes('vs') ||
    taskDescription.toLowerCase().includes('compare') ||
    taskDescription.toLowerCase().includes('salary');

  // Use more tokens for detailed responses
  const maxTokens = isComparison ? 8000 : 6000;

  // Extract ALL sources with titles and FULL URLs
  const sourceRegex = /\*\*\d+\.\s*([^*]+)\*\*[^🔗]*🔗\s*(https?:\/\/[^\s\n]+)/g;
  const sources: Array<{ title: string; url: string }> = [];
  let match;
  while ((match = sourceRegex.exec(rawResult)) !== null) {
    sources.push({ title: match[1].trim(), url: match[2].trim() });
  }

  // Create numbered sources reference with full context
  const sourcesRef = sources.length > 0
    ? sources.map((s, i) => `[${i + 1}] "${s.title}" - ${s.url}`).join('\n')
    : 'No sources identified';

  // Logging
  console.log('\n[LLM Summary] ═══════════════════════════════════════════');
  console.log('[LLM Summary] Original Query:', userQuery || '(not provided)');
  console.log('[LLM Summary] Task:', taskDescription);
  console.log('[LLM Summary] Intent:', intent);
  console.log('[LLM Summary] Is Comparison:', isComparison);
  console.log('[LLM Summary] Max Tokens:', maxTokens);
  console.log('[LLM Summary] Sources Identified:', sources.length);
  sources.forEach((s, i) => console.log(`  [${i + 1}] ${s.title} (${s.url})`));
  console.log('───────────────────────────────────────────────────────');

  const response = await createChatCompletion({
    messages: [
      {
        role: 'system',
        content: `You are an EXPERT RESEARCH ANALYST that produces COMPREHENSIVE, DATA-DRIVEN insights.

CURRENT DATE: ${currentDate}

${intentPrompt}

=== DATA INTEGRITY PROTOCOL ===
BASE YOUR ANSWER STRICTLY ON THE PROVIDED SEARCH DATA. NEVER extrapolate, assume, or invent information.

CRITICAL VALIDATION RULES:
1. ❌ NEVER fabricate information about future events, scores, or outcomes
2. ❌ NEVER generate hypothetical scenarios or "what if" projections
3. ✅ ONLY report facts explicitly stated in the search data
4. ✅ For incomplete data, clearly state limitations

=== FORMATTING PROTOCOL ===
- Use **BOLD** for key terms and numbers
- Use bullet points for lists
- Use tables for comparisons
- INLINE CITATIONS: [1], [2] after each fact
- Example: "Software engineers earn **$180K-$250K** annually [1]"

=== QUALITY CHECKLIST ===
✅ Answer the ORIGINAL USER QUESTION directly
✅ Include specific data points and ranges
✅ Provide context and explanations
✅ End with complete sources section`,
      },
      {
        role: 'user',
        content: `ORIGINAL USER QUESTION: "${userQuery || taskDescription}"

Task Being Executed: ${taskDescription}

Available Sources:
${sourcesRef}

Search Data:
${rawResult.substring(0, 12000)}

Provide a comprehensive answer to the ORIGINAL USER QUESTION using the search data above. Include inline [1], [2] citations after each fact.`,
      },
    ],
    temperature: 0.2,
    max_tokens: maxTokens,
  }) as any;

  let summary = response.choices[0]?.message?.content || rawResult;

  // Ensure sources are included
  if (sources.length > 0 && !summary.includes('Sources:')) {
    summary += '\n\n📚 **Sources:**\n' + sources.slice(0, 8).map((s, i) =>
      `[${i + 1}] ${s.title} - ${s.url}`
    ).join('\n');
  }

  console.log('[LLM Summary] Response Length:', summary.length, 'chars');
  console.log('[LLM Summary] ═══════════════════════════════════════════\n');

  return summary;
}

/**
 * Stream the tool result summary (for SSE)
 */
export async function streamSummarizeToolResult(
  taskDescription: string,
  toolName: string,
  rawResult: string,
  userQuery?: string
): Promise<AsyncIterable<any>> {
  const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  // Always give detailed responses for search/comparison queries
  const isComparison = taskDescription.toLowerCase().includes('vs') ||
    taskDescription.toLowerCase().includes('compare') ||
    taskDescription.toLowerCase().includes('salary');

  const maxTokens = isComparison ? 8000 : 6000; // Significantly increased for comprehensive streaming responses

  // Extract sources
  const sourceRegex = /\*\*\d+\.\s*([^*]+)\*\*[^🔗]*🔗\s*(https?:\/\/[^\s\n]+)/g;
  const sources: Array<{ title: string; url: string }> = [];
  let match;
  while ((match = sourceRegex.exec(rawResult)) !== null) {
    sources.push({ title: match[1].trim(), url: match[2].trim() });
  }

  const sourcesRef = sources.length > 0
    ? sources.map((s, i) => `[${i + 1}] "${s.title}" - ${s.url}`).join('\n')
    : 'No sources identified';

  // Log start of stream
  console.log('\n[LLM Stream] ═══════════════════════════════════════════');
  console.log('[LLM Stream] Task:', taskDescription);
  console.log('[LLM Stream] Sources:', sources.length);

  const stream = await createChatCompletion({
    messages: [
      {
        role: 'system',
        content: `You are an EXPERT RESEARCH ANALYST that produces COMPREHENSIVE, DATA-DRIVEN insights like the world's best research firms.

CURRENT DATE: ${currentDate} - Remember that you cannot provide information about events that occur after this date.

=== DATA INTEGRITY PROTOCOL ===
BASE YOUR ANSWER STRICTLY ON THE PROVIDED SEARCH DATA. NEVER extrapolate, assume, or invent information.

CRITICAL VALIDATION RULES:
1. ❌ NEVER fabricate information about future events, scores, or outcomes
2. ❌ NEVER generate hypothetical scenarios or "what if" projections
3. ❌ NEVER combine data from different time periods inappropriately
4. ✅ ONLY report facts explicitly stated in the search data
5. ✅ For incomplete data, clearly state limitations
6. ✅ Distinguish between historical and projected information

=== ADVANCED RESPONSE FRAMEWORK ===

**PHASE 1: EXECUTIVE SUMMARY**
- Start with a compelling overview (2-3 paragraphs)
- Highlight key findings and insights
- Set context and importance of the topic
- Preview major conclusions

**PHASE 2: DEEP ANALYSIS**
- Break down complex data into digestible sections
- Use quantitative analysis where possible
- Provide context and explanations for data points
- Compare and contrast different perspectives
- Identify trends, patterns, and anomalies

**PHASE 3: STRUCTURED INSIGHTS**
- Use emoji headers for visual organization (💰, 📈, 🎯, ⚠️)
- Create comparison tables for quantitative data
- Include methodology explanations
- Discuss data quality and limitations

**PHASE 4: ACTIONABLE RECOMMENDATIONS**
- Provide specific, practical advice
- Include decision frameworks
- Suggest next steps or further research
- Address common questions or concerns

=== ENHANCED FORMATTING PROTOCOL ===

**Data Visualization:**
- Use MARKDOWN TABLES for comparisons and structured data
- Format numbers consistently (e.g., $150K-$200K, 15-25%)
- Use bullet points for lists and sequential information
- Employ blockquotes for critical insights

**Typography Hierarchy:**
- **BOLD** for key terms, numbers, and company names
- *Italics* for emphasis and definitions
- \`Code\` for technical terms or exact phrases
- > Blockquotes for critical insights or warnings

**Citation Excellence:**
- INLINE CITATIONS: [SourceName](URL) immediately after facts
- Example: "Software engineers earn **$180K-$250K** annually [levels.fyi](https://levels.fyi)"
- Include source credibility context when relevant
- List all sources in a dedicated section

=== DOMAIN-SPECIFIC STRUCTURES ===

**💰 SALARY ANALYSIS FRAMEWORK:**
\`\`\`markdown
## 💰 Salary Landscape Overview
[Comprehensive market analysis]

## 📊 Company Compensation Breakdown
| Company | Role | Base Salary | Total Comp | Source |
|---------|------|-------------|------------|---------|
| Company A | Senior Engineer | $150K-$200K | $250K-$350K | [levels.fyi](url) |

## 🎯 Key Comparison Insights
- Direct compensation comparisons
- Regional variations analysis
- Benefits and perks evaluation

## ✅ Strategic Recommendations
[Actionable career advice based on data]
\`\`\`

**📈 MARKET RESEARCH FRAMEWORK:**
\`\`\`markdown
## 📈 Market Overview & Trends
[Industry analysis and trends]

## 🔍 Competitive Analysis
[Detailed competitor comparisons]

## 🎯 Strategic Opportunities
[Market gaps and opportunities]

## ⚠️ Risk Assessment
[Potential challenges and risks]
\`\`\`

=== QUALITY ASSURANCE CHECKLIST ===

**Content Depth:**
- ✅ Minimum 400-600 words for complex topics
- ✅ Include specific data points and ranges
- ✅ Provide context and explanations
- ✅ Address counter-arguments or limitations

**Data Accuracy:**
- ✅ Verify all statistics against source data
- ✅ Note data freshness and methodology
- ✅ Highlight any data gaps or uncertainties
- ✅ Use conservative estimates when ranges are wide

**User Value:**
- ✅ Answer the original question comprehensively
- ✅ Anticipate follow-up questions
- ✅ Provide decision-making frameworks
- ✅ Include practical next steps

**Professional Polish:**
- ✅ Error-free writing and formatting
- ✅ Consistent terminology and style
- ✅ Logical flow and organization
- ✅ Engaging yet professional tone

=== FINAL OUTPUT REQUIREMENTS ===

- Write comprehensive answers (400-800 words for complex queries)
- Include inline citations for ALL facts and figures
- End with complete sources section
- Format for excellent readability and visual appeal
- Ensure every claim is supported by the provided data`,
      },
      {
        role: 'user',
        content: `Task: ${taskDescription}

Available Sources:
${sourcesRef}

Full Search Data:
${rawResult.substring(0, 12000)}

Write a comprehensive, detailed answer with inline [1], [2] citations after each fact. Include the full sources section at the end.`,
      },
    ],
    temperature: 0.2, // Lower temperature for more factual, consistent responses
    max_tokens: maxTokens,
    stream: true,
  }) as unknown as AsyncIterable<any>;

  return stream;
}
