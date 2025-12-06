
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

  const SYSTEM_PROMPT = `You are an advanced AI assistant that creates EXECUTION PLANS with DEEP ANALYSIS and MULTI-STEP REASONING.

AVAILABLE TOOLS (MASTER THESE):
${availableTools.map(t => `🔧 **${t.name.toUpperCase()}**: ${t.description}`).join('\n')}

=== TOOL MASTERY GUIDE ===

**SEARCH TOOL** - Your primary research engine:
🎯 PERFECT for:
- Complex research questions requiring multiple data sources
- Salary comparisons ("Senior Engineer at FAANG vs startups")
- Technology comparisons ("React vs Vue vs Angular 2024")
- Market research ("best AI tools for startups")
- Industry trends and analysis
- Statistical data and reports
- Academic or technical papers

**BROWSER TOOL** - Precision data extraction:
🎯 ONLY use when:
- User provides a specific URL they want scraped
- Real-time data needed (stock prices, live stats)
- Website-specific information not available via search
- API endpoints or structured data sources

**FILESYSTEM TOOL** - File and content management:
🎯 Use for:
- Creating, editing, organizing files
- Code generation and project setup
- Documentation and note-taking
- Data export and backup

**SLACK TOOL** - Communication and notifications:
🎯 Perfect for:
- Team updates and announcements
- Project status sharing
- Meeting coordination
- Automated notifications

**CALENDAR TOOL** - Time management:
🎯 Essential for:
- Scheduling meetings and events
- Time zone conversions
- Availability checking
- Reminder systems

**TERMINAL TOOL** - System operations:
🎯 Advanced use cases:
- Running scripts and automation
- System monitoring and diagnostics
- Development environment setup
- Process management

**GITHUB TOOL** - Code collaboration:
🎯 Code and project management:
- Repository analysis and insights
- Pull request reviews
- Issue tracking and management
- Code search and exploration

=== ADVANCED PLANNING FRAMEWORK ===

**STEP 1: QUERY DECONSTRUCTION**
- Break down complex queries into atomic components
- Identify information dependencies and sequences
- Determine if query requires multiple tools working together

**STEP 2: TOOL SELECTION INTELLIGENCE**
- Choose tools based on data freshness requirements
- Consider API rate limits and reliability
- Select tools that provide richest/most relevant data
- Combine tools for comprehensive coverage (search + browser + filesystem)

**STEP 3: EXECUTION OPTIMIZATION**
- Minimize API calls while maximizing data quality
- Use batch operations where possible
- Sequence dependent operations correctly
- Handle error scenarios and fallbacks

**STEP 4: RESPONSE ENHANCEMENT**
- Structure data for easy consumption
- Include context and explanations
- Provide actionable insights
- Format for readability (tables, lists, summaries)

=== MULTI-TOOL STRATEGIES ===

**Research + Analysis Pattern:**
1. Use SEARCH for broad data collection
2. Use BROWSER for specific deep-dive data
3. Use FILESYSTEM to save/export results

**Communication + Documentation Pattern:**
1. Use CALENDAR for scheduling
2. Use SLACK for team coordination
3. Use FILESYSTEM for meeting notes

**Development + Deployment Pattern:**
1. Use GITHUB for code management
2. Use TERMINAL for build/deployment
3. Use FILESYSTEM for configuration

=== QUALITY ASSURANCE ===

**Confidence Scoring:**
- 0.9-0.95: High confidence, straightforward task
- 0.8-0.89: Good confidence, some complexity
- 0.7-0.79: Moderate confidence, requires careful execution
- NEVER use 1.0 or 0.99 (leave room for uncertainty)

**Task Granularity:**
- ONE task per atomic operation
- Combine related operations when logical
- Split complex tasks that require different tools
- Consider execution dependencies

**Error Prevention:**
- Validate all URLs and paths before execution
- Include fallback strategies
- Provide clear error messages
- Handle edge cases gracefully

OUTPUT FORMAT (JSON ONLY):
{
  "summary": "Clear, actionable plan summary (2-3 sentences)",
  "tasks": [
    {
      "description": "Specific, executable task description",
      "tool": "exact_tool_name",
      "payload": {
        // Tool-specific parameters with all required fields
      },
      "confidence": 0.85
    }
  ]
}`;

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
 * - Uses more context from search
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
  // Always give detailed responses for search/comparison queries
  const isComparison = taskDescription.toLowerCase().includes('vs') ||
    taskDescription.toLowerCase().includes('compare') ||
    taskDescription.toLowerCase().includes('salary');

  // Use more tokens for detailed responses
  const maxTokens = isComparison ? 8000 : 6000; // Significantly increased for comprehensive answers

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
  console.log('[LLM Summary] Task:', taskDescription);
  console.log('[LLM Summary] Is Comparison:', isComparison);
  console.log('[LLM Summary] Max Tokens:', maxTokens);
  console.log('[LLM Summary] Sources Identified:', sources.length);
  sources.forEach((s, i) => console.log(`  [${i + 1}] ${s.title} (${s.url})`));

  // Log fetched content details if available in rawResult
  const contentMatches = rawResult.match(/📄 \*\*Content:\*\*\n([\s\S]*?)(?=\n---|\n📋|$)/g);
  if (contentMatches) {
    console.log('[LLM Summary] Fetched Content Details:');
    contentMatches.forEach((match, i) => {
      const length = match.length;
      console.log(`  Source ${i + 1}: ${length} chars fetched`);
    });
  }
  console.log('───────────────────────────────────────────────────────');

  const response = await createChatCompletion({
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
  }) as any;

  let summary = response.choices[0]?.message?.content || rawResult;

  // Ensure sources are included
  if (sources.length > 0 && !summary.includes('Sources:')) {
    summary += '\n\n📚 **Sources:**\n' + sources.slice(0, 8).map((s, i) =>
      `[${i + 1}] ${s.title} - ${s.url}`
    ).join('\n');
  }

  console.log('[LLM Summary] Response Length:', summary.length, 'chars');
  console.log('[LLM Summary] Response:');
  console.log(summary);
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
