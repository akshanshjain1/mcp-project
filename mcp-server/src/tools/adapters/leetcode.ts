export interface LeetCodePayload {
    action: 'get_problem' | 'search';
    problemId?: number;
    titleSlug?: string;
    query?: string;
}

interface LeetCodeProblem {
    questionId: string;
    title: string;
    titleSlug: string;
    difficulty: string;
    content: string;
    exampleTestcases: string;
    topicTags: Array<{ name: string }>;
    codeSnippets: Array<{ lang: string; langSlug: string; code: string }>;
}

/**
 * LeetCode adapter using their public GraphQL API
 * Fetches problem details, examples, and starter code
 */
export async function executeLeetCode(payload: LeetCodePayload): Promise<string> {
    const { action, problemId, titleSlug, query } = payload;

    switch (action) {
        case 'get_problem': {
            // Convert problem ID to slug if needed
            let slug = titleSlug;
            if (problemId && !slug) {
                const idSlug = await getSlugFromId(problemId);
                slug = idSlug || undefined;
                if (!slug) {
                    return `❌ Could not find LeetCode problem #${problemId}. Try using the problem title slug instead.`;
                }
            }

            if (!slug) {
                return '❌ Please provide either a problemId or titleSlug';
            }

            const problem = await fetchProblem(slug);
            if (!problem) {
                return `❌ Could not fetch problem: ${slug}`;
            }

            return formatProblem(problem);
        }

        case 'search': {
            if (!query) {
                return '❌ Please provide a search query';
            }
            return searchProblems(query);
        }

        default:
            return `❌ Unknown action: ${action}. Use 'get_problem' or 'search'.`;
    }
}

async function getSlugFromId(problemId: number): Promise<string | null> {
    // Since we can't easily map ID to slug without a huge list or search,
    // and the Alfa API works best with slugs, we'll try a direct search approach if possible
    // or just ask the user to provide the slug.
    // However, the Alfa API has an endpoint for problem list which might help, but it's heavy.

    // Fallback: Return null and let the user know to use titleSlug
    return null;
}

async function fetchProblem(titleSlug: string): Promise<LeetCodeProblem | null> {
    try {
        // Use the Alfa LeetCode API which is a stable public wrapper
        const response = await fetch(`https://alfa-leetcode-api.onrender.com/select?titleSlug=${titleSlug}`);

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json() as any;

        if (!data || !data.questionId) {
            return null;
        }

        // Map Alfa API response to our internal interface
        return {
            questionId: data.questionId,
            title: data.questionTitle,
            titleSlug: data.titleSlug,
            difficulty: data.difficulty,
            content: data.question, // HTML content
            exampleTestcases: data.exampleTestcases,
            topicTags: data.topicTags || [],
            codeSnippets: data.codeSnippets || []
        };
    } catch (error) {
        console.error('Failed to fetch LeetCode problem:', error);
        return null;
    }
}

function formatProblem(problem: LeetCodeProblem): string {
    // Clean HTML content
    const cleanContent = problem.content
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    // Get TypeScript/JavaScript code snippet
    const tsSnippet = problem.codeSnippets?.find(s => s.langSlug === 'typescript');
    const jsSnippet = problem.codeSnippets?.find(s => s.langSlug === 'javascript');
    const pythonSnippet = problem.codeSnippets?.find(s => s.langSlug === 'python3');
    const snippet = tsSnippet || jsSnippet || pythonSnippet;

    const tags = problem.topicTags?.map(t => t.name).join(', ') || 'None';

    const difficultyEmoji = {
        Easy: '🟢',
        Medium: '🟡',
        Hard: '🔴',
    }[problem.difficulty] || '⚪';

    let result = `# LeetCode #${problem.questionId}: ${problem.title}

${difficultyEmoji} **Difficulty**: ${problem.difficulty}
🏷️ **Tags**: ${tags}
🔗 **Link**: https://leetcode.com/problems/${problem.titleSlug}/

---

## Problem Description

${cleanContent}

---

## Example Test Cases

\`\`\`
${problem.exampleTestcases || 'No examples provided'}
\`\`\`
`;

    if (snippet) {
        result += `
---

## Starter Code (${snippet.lang})

\`\`\`${snippet.langSlug}
${snippet.code}
\`\`\`
`;
    }

    return result;
}

async function searchProblems(query: string): Promise<string> {
    // For now, return helpful search tips
    return `🔍 **LeetCode Search: "${query}"**

To find a specific problem, you can:

1. **By ID**: Use \`get_problem\` with \`problemId: 2342\`
2. **By Slug**: Use \`get_problem\` with \`titleSlug: "two-sum"\`

**Popular problems:**
- #1 Two Sum → \`titleSlug: "two-sum"\`
- #2 Add Two Numbers → \`titleSlug: "add-two-numbers"\`
- #3 Longest Substring → \`titleSlug: "longest-substring-without-repeating-characters"\`
- #121 Best Time to Buy Stock → \`titleSlug: "best-time-to-buy-and-sell-stock"\`

🔗 Browse all: https://leetcode.com/problemset/`;
}
