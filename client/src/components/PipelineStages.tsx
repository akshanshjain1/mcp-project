/**
 * Pipeline Stages UI Component
 * Shows visual progress through the execution pipeline
 */

import React from 'react';

export interface PipelineStage {
    id: string;
    name: string;
    icon: string;
    status: 'pending' | 'active' | 'complete' | 'failed';
}

interface PipelineStagesProps {
    stages: PipelineStage[];
    currentStage?: string;
    className?: string;
}

export function PipelineStages({ stages, currentStage, className = '' }: PipelineStagesProps) {
    const getStageStatus = (stage: PipelineStage, _index: number) => {
        if (stage.status === 'complete') return 'complete';
        if (stage.status === 'failed') return 'failed';
        if (stage.id === currentStage) return 'active';
        return 'pending';
    };

    const statusStyles = {
        pending: 'bg-gray-100 text-gray-400 border-gray-200',
        active: 'bg-brand-indigo/10 text-brand-indigo border-brand-indigo animate-pulse',
        complete: 'bg-green-100 text-green-600 border-green-300',
        failed: 'bg-red-100 text-red-600 border-red-300',
    };

    const connectorStyles = {
        pending: 'bg-gray-200',
        active: 'bg-brand-indigo/30',
        complete: 'bg-green-300',
        failed: 'bg-red-300',
    };

    return (
        <div className={`flex items-center justify-center gap-1 py-3 ${className}`}>
            {stages.map((stage, index) => {
                const status = getStageStatus(stage, index);
                return (
                    <React.Fragment key={stage.id}>
                        {/* Stage indicator */}
                        <div className="relative group">
                            <div className={`
                                flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                                border transition-all duration-300
                                ${statusStyles[status]}
                            `}>
                                <span>{stage.icon}</span>
                                <span className="hidden sm:inline">{stage.name}</span>
                                {status === 'active' && (
                                    <span className="w-1.5 h-1.5 bg-brand-indigo rounded-full animate-bounce" />
                                )}
                                {status === 'complete' && (
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>

                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 
                                bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 
                                transition-opacity whitespace-nowrap pointer-events-none z-10">
                                {stage.name}
                            </div>
                        </div>

                        {/* Connector */}
                        {index < stages.length - 1 && (
                            <div className={`w-4 h-0.5 ${connectorStyles[status]}`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

/**
 * Default pipeline stages for Perplexity-style execution
 */
export const DEFAULT_PIPELINE_STAGES: PipelineStage[] = [
    { id: 'parse', name: 'Parse', icon: '🔍', status: 'pending' },
    { id: 'plan', name: 'Plan', icon: '📋', status: 'pending' },
    { id: 'execute', name: 'Execute', icon: '⚡', status: 'pending' },
    { id: 'summarize', name: 'Summarize', icon: '✨', status: 'pending' },
];

/**
 * Hook to manage pipeline stage state
 */
export function usePipelineStages(initialStages = DEFAULT_PIPELINE_STAGES) {
    const [stages, setStages] = React.useState(initialStages);
    const [currentStage, setCurrentStage] = React.useState<string | undefined>();

    const updateStage = (stageId: string, status: PipelineStage['status']) => {
        setStages(prev => prev.map(s =>
            s.id === stageId ? { ...s, status } : s
        ));
        if (status === 'active') {
            setCurrentStage(stageId);
        }
    };

    const resetStages = () => {
        setStages(initialStages.map(s => ({ ...s, status: 'pending' })));
        setCurrentStage(undefined);
    };

    const completeStage = (stageId: string) => {
        updateStage(stageId, 'complete');
    };

    const failStage = (stageId: string) => {
        updateStage(stageId, 'failed');
    };

    const startStage = (stageId: string) => {
        updateStage(stageId, 'active');
    };

    return {
        stages,
        currentStage,
        updateStage,
        resetStages,
        completeStage,
        failStage,
        startStage,
    };
}

export default PipelineStages;
