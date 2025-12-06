import { Task } from '../lib/types';
import { formatJSON } from '../utils/copy';

interface ConfirmModalProps {
    task: Task;
    onConfirm: () => void;
    onCancel: () => void;
    isExecuting: boolean;
}

export function ConfirmModal({ task, onConfirm, onCancel, isExecuting }: ConfirmModalProps) {
    return (
        <div className="modal-backdrop flex items-center justify-center p-4" onClick={onCancel}>
            <div
                className="modal-content bg-white rounded-2xl shadow-card p-6 max-w-lg w-full border border-light-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                        <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold text-gray-900">Confirm Execution</h3>
                        <p className="text-sm text-gray-500">This action requires your approval</p>
                    </div>
                </div>

                {/* Warning Banner */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <p className="text-sm text-amber-800 font-medium">Safe Mode Active</p>
                            <p className="text-xs text-amber-700 mt-1">
                                This task will be executed using the <strong className="text-amber-900">{task.tool}</strong> tool.
                                Please review the payload carefully before confirming.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Task Details */}
                <div className="space-y-4 mb-6">
                    <div>
                        <span className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Task</span>
                        <p className="text-gray-800">{task.description}</p>
                    </div>

                    <div>
                        <span className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Tool</span>
                        <span className="px-3 py-1 bg-brand-indigo/10 text-brand-indigo rounded-lg text-sm font-medium">
                            {task.tool}
                        </span>
                    </div>

                    <div>
                        <span className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Payload</span>
                        <pre className="p-3 bg-gray-900 text-gray-100 rounded-xl text-xs font-mono max-h-40 overflow-y-auto border border-gray-800">
                            {formatJSON(task.payload)}
                        </pre>
                    </div>

                    <div>
                        <span className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Confidence</span>
                        <span className="text-lg font-semibold text-brand-indigo">
                            {Math.round(task.confidence * 100)}%
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isExecuting}
                        className="flex-1 py-3 rounded-xl font-medium bg-light-200 text-gray-700 
                     hover:bg-light-300 transition-all duration-300 
                     disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isExecuting}
                        className="flex-1 py-3 rounded-xl font-medium bg-gradient-to-r from-green-500 to-emerald-500 
                     text-white hover:shadow-lg hover:shadow-green-500/30
                     transition-all duration-300 flex items-center justify-center gap-2 
                     disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExecuting ? (
                            <>
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Executing...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Confirm & Execute
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
