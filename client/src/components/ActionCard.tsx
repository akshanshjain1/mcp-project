import { Task, ToolName } from '../lib/types';
import { copyToClipboard, formatJSON } from '../utils/copy';
import { useState } from 'react';

interface ActionCardProps {
    task: Task;
    onApprove: (task: Task) => void;
}

const TOOL_ICONS: Record<ToolName, string> = {
    filesystem: '📁',
    github: '🐙',
    slack: '💬',
    calendar: '📅',
    terminal: '⚡',
    browser: '🌐',
    search: '🔍',
    leetcode: '💻',
};

const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
    filesystem: 'File System',
    github: 'GitHub',
    slack: 'Slack',
    calendar: 'Calendar',
    terminal: 'Terminal',
    browser: 'Browser Fetch',
    search: 'Web Search',
    leetcode: 'LeetCode',
};

export function ActionCard({ task, onApprove }: ActionCardProps) {
    const [copied, setCopied] = useState(false);

    const handleCopyPayload = async () => {
        const success = await copyToClipboard(formatJSON(task.payload));
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const getStatusLabel = () => {
        switch (task.status) {
            case 'pending': return 'Pending Approval';
            case 'approved': return 'Approved';
            case 'executing': return 'Executing...';
            case 'success': return 'Completed';
            case 'failed': return 'Failed';
            default: return task.status;
        }
    };

    const confidencePercent = Math.round(task.confidence * 100);
    const confidenceColor = task.confidence >= 0.8 ? 'text-green-400' : task.confidence >= 0.5 ? 'text-yellow-400' : 'text-red-400';

    return (
        <div className="glass-card p-5 animated-border">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{TOOL_ICONS[task.tool]}</span>
                    <div>
                        <span className={`tool-badge tool-${task.tool}`}>
                            {TOOL_DESCRIPTIONS[task.tool]}
                        </span>
                    </div>
                </div>

                <span className={`status-${task.status} px-3 py-1 rounded-full text-xs font-medium`}>
                    {getStatusLabel()}
                </span>
            </div>

            {/* Description */}
            <p className="text-gray-200 mb-4 leading-relaxed">
                {task.description}
            </p>

            {/* Payload Preview */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Payload</span>
                    <button
                        onClick={handleCopyPayload}
                        className="text-xs text-accent-primary hover:text-accent-secondary transition-colors flex items-center gap-1"
                    >
                        {copied ? (
                            <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Copied!
                            </>
                        ) : (
                            <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy
                            </>
                        )}
                    </button>
                </div>
                <pre className="code-block text-xs text-gray-400 max-h-32 overflow-y-auto">
                    {formatJSON(task.payload)}
                </pre>
            </div>

            {/* Confidence Score */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Confidence</span>
                    <span className={`text-sm font-medium ${confidenceColor}`}>
                        {confidencePercent}%
                    </span>
                </div>
                <div className="confidence-bar">
                    <div
                        className="confidence-fill"
                        style={{ width: `${confidencePercent}%` }}
                    />
                </div>
            </div>

            {/* Result (if executed) */}
            {task.status === 'success' && task.result && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <span className="text-xs text-green-400 uppercase tracking-wider block mb-1">Result</span>
                    <p className="text-sm text-green-300">{task.result}</p>
                </div>
            )}

            {task.status === 'failed' && task.error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <span className="text-xs text-red-400 uppercase tracking-wider block mb-1">Error</span>
                    <p className="text-sm text-red-300">{task.error}</p>
                </div>
            )}

            {/* Approve Button */}
            {task.status === 'pending' && (
                <button
                    onClick={() => onApprove(task)}
                    className="w-full py-3 rounded-xl font-medium bg-gradient-to-r from-accent-success/80 to-emerald-600/80 text-white hover:from-accent-success hover:to-emerald-600 transition-all duration-300 flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Approve & Execute
                </button>
            )}

            {task.status === 'executing' && (
                <div className="w-full py-3 rounded-xl bg-dark-600 text-gray-400 flex items-center justify-center gap-2">
                    <span className="spinner" />
                    Executing...
                </div>
            )}
        </div>
    );
}
