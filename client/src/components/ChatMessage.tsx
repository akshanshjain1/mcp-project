import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Task } from '../lib/types';

interface ChatMessageProps {
    type: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: Date;
    task?: Task;
    onApprove?: (task: Task) => void;
    isLoading?: boolean;
}

// Source badge component - clickable pill that opens URL
function SourceBadge({ href, children }: { href: string; children: React.ReactNode }) {
    // Extract domain name for display
    const getDomain = (url: string) => {
        try {
            const domain = new URL(url).hostname.replace('www.', '');
            // Get just the main site name (e.g., "levels.fyi" from "levels.fyi")
            const parts = domain.split('.');
            return parts.length > 2 ? parts.slice(-2).join('.') : domain;
        } catch {
            return url;
        }
    };

    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 
                 bg-brand-indigo/10 hover:bg-brand-indigo/20 
                 text-brand-indigo text-xs font-medium rounded-full
                 transition-colors cursor-pointer no-underline
                 border border-brand-indigo/20 hover:border-brand-indigo/30"
        >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {children || getDomain(href)}
        </a>
    );
}

// Custom markdown components to render source badges and scrollable tables
const markdownComponents: Partial<Components> = {
    a: ({ href, children }) => {
        if (!href) return <>{children}</>;
        return <SourceBadge href={href}>{children}</SourceBadge>;
    },
    table: ({ children, ...props }) => (
        <div className="table-scroll-wrapper">
            <table {...props} className="min-w-full divide-y divide-gray-200">
                {children}
            </table>
        </div>
    ),
};

export function ChatMessage({ type, content, timestamp, task, onApprove, isLoading }: ChatMessageProps) {
    const isUser = type === 'user';
    const isSystem = type === 'system';

    // Tool emoji mapping
    const toolEmoji: Record<string, string> = {
        filesystem: '📁',
        github: '🐙',
        slack: '💬',
        calendar: '📅',
        terminal: '⚡',
        browser: '🌐',
        search: '🔍',
        leetcode: '💻',
    };

    // Status colors
    const statusColors: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        approved: 'bg-blue-100 text-blue-700 border-blue-200',
        executing: 'bg-purple-100 text-purple-700 border-purple-200 animate-pulse',
        success: 'bg-green-100 text-green-700 border-green-200',
        failed: 'bg-red-100 text-red-700 border-red-200',
    };

    return (
        <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`
          ${isUser ? 'max-w-[85%]' : 'max-w-full'} rounded-2xl px-4 py-3 shadow-soft
          ${isUser
                        ? 'bg-gradient-to-r from-brand-indigo to-brand-purple text-white rounded-br-md'
                        : isSystem
                            ? 'bg-light-100 text-gray-600 text-sm border border-light-300'
                            : 'bg-white text-gray-800 rounded-bl-md border border-light-300'
                    }
        `}
            >
                {/* Loading indicator */}
                {isLoading && (
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                            <span className="w-2 h-2 bg-brand-indigo rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 bg-brand-indigo rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 bg-brand-indigo rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-gray-600 text-sm">Thinking...</span>
                    </div>
                )}

                {/* Task card */}
                {task && !isLoading && (
                    <div className="space-y-3">
                        {/* Task header */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xl">{toolEmoji[task.tool] || '🔧'}</span>
                            <span className="font-medium capitalize text-gray-900">{task.tool}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs border ${statusColors[task.status]}`}>
                                {task.status}
                            </span>
                            <span className="text-xs text-gray-500 ml-auto">
                                {Math.round(task.confidence * 100)}% confident
                            </span>
                        </div>

                        {/* Task description */}
                        <p className="text-sm text-gray-700">{task.description}</p>

                        {/* Payload preview */}
                        <details className="text-xs">
                            <summary className="cursor-pointer text-gray-500 hover:text-gray-700 transition-colors">
                                View payload
                            </summary>
                            <pre className="mt-2 p-2 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-xs font-mono border border-gray-800">
                                {JSON.stringify(task.payload, null, 2)}
                            </pre>
                        </details>

                        {/* Logs */}
                        {task.logs && task.logs.length > 0 && (
                            <div className="mt-2 mb-2">
                                <details className="group">
                                    <summary className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-700 select-none">
                                        <span className="group-open:rotate-90 transition-transform">▶</span>
                                        <span>View Search Progress ({task.logs.length} steps)</span>
                                    </summary>
                                    <div className="mt-2 pl-4 border-l-2 border-gray-100 space-y-1">
                                        {task.logs.map((log, i) => (
                                            <div key={i} className="text-xs text-gray-500 font-mono break-all">
                                                {log}
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            </div>
                        )}

                        {/* Result */}
                        {(task.result || task.error || (task.status === 'executing' && task.result !== undefined)) && (
                            <div className={`p-3 rounded-lg border ${task.error ? 'bg-red-50 border-red-200' : task.status === 'executing' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
                                <p className="text-xs text-gray-600 mb-1 font-medium">
                                    {task.error ? 'Error' : task.status === 'executing' ? 'Generating...' : 'Result'}
                                </p>
                                <div className="prose prose-sm max-w-none">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                        {task.error || task.result || ''}
                                    </ReactMarkdown>
                                    {task.status === 'executing' && (
                                        <span className="inline-block w-2 h-4 ml-1 bg-brand-indigo animate-pulse align-middle" />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Approve button */}
                        {task.status === 'pending' && onApprove && (
                            <button
                                onClick={() => onApprove(task)}
                                className="w-full mt-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 
                         text-white rounded-xl font-medium text-sm
                         hover:shadow-lg hover:shadow-green-500/30
                         transition-all duration-300 flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Approve & Execute
                            </button>
                        )}
                    </div>
                )}

                {/* Regular message content */}
                {!task && !isLoading && (
                    <div className="prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                            {content}
                        </ReactMarkdown>
                    </div>
                )}

                {/* Timestamp */}
                {timestamp && (
                    <p className={`text-xs mt-2 ${isUser ? 'text-white/70' : 'text-gray-500'}`}>
                        {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                )}
            </div>
        </div>
    );
}
