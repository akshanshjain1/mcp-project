import { Plan, Task } from '../lib/types';
import { ActionCard } from './ActionCard';
import { downloadJSON } from '../utils/copy';

interface PlanViewerProps {
    plan: Plan;
    onApproveTask: (task: Task) => void;
    onReset: () => void;
}

export function PlanViewer({ plan, onApproveTask, onReset }: PlanViewerProps) {
    const pendingCount = plan.tasks.filter(t => t.status === 'pending').length;
    const completedCount = plan.tasks.filter(t => t.status === 'success').length;
    const failedCount = plan.tasks.filter(t => t.status === 'failed').length;

    const handleDownload = () => {
        const filename = `plan-${plan.id}.json`;
        downloadJSON(plan, filename);
    };

    return (
        <div className="space-y-6">
            {/* Plan Header */}
            <div className="glass-card p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 flex items-center justify-center">
                            <span className="text-2xl">📋</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-100">Execution Plan</h2>
                            <p className="text-sm text-gray-500">
                                Generated at {new Date(plan.createdAt).toLocaleString()}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleDownload}
                            className="px-4 py-2 rounded-lg bg-dark-600 text-gray-300 hover:bg-dark-500 transition-colors flex items-center gap-2 text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download JSON
                        </button>
                        <button
                            onClick={onReset}
                            className="px-4 py-2 rounded-lg bg-dark-600 text-gray-300 hover:bg-dark-500 transition-colors flex items-center gap-2 text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            New Analysis
                        </button>
                    </div>
                </div>

                {/* Summary */}
                <div className="bg-dark-700/50 rounded-xl p-4 mb-4">
                    <span className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Summary</span>
                    <p className="text-gray-200 leading-relaxed">{plan.summary}</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-dark-700/50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-gray-100">{plan.tasks.length}</p>
                        <p className="text-xs text-gray-500">Total Tasks</p>
                    </div>
                    <div className="bg-dark-700/50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
                        <p className="text-xs text-gray-500">Pending</p>
                    </div>
                    <div className="bg-dark-700/50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-green-400">{completedCount}</p>
                        <p className="text-xs text-gray-500">Completed</p>
                    </div>
                    <div className="bg-dark-700/50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-red-400">{failedCount}</p>
                        <p className="text-xs text-gray-500">Failed</p>
                    </div>
                </div>
            </div>

            {/* Task List */}
            <div>
                <h3 className="text-lg font-medium text-gray-200 mb-4 flex items-center gap-2">
                    <span className="text-xl">⚡</span>
                    Actions ({plan.tasks.length})
                </h3>
                <div className="grid gap-4">
                    {plan.tasks.map((task) => (
                        <ActionCard
                            key={task.id}
                            task={task}
                            onApprove={onApproveTask}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
