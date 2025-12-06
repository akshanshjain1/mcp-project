import React, { useState } from 'react';

interface EmailInputProps {
    onAnalyze: (text: string) => void;
    isLoading: boolean;
}

const EXAMPLE_EMAIL = `Hi team,

Please handle the following tasks:

1. Create a new file called "meeting-notes.md" with today's discussion points
2. Send a Slack message to #engineering about the deployment schedule
3. Create a GitHub issue for the authentication bug we discovered
4. Add a calendar event for the design review meeting on Friday at 2pm
5. Fetch the latest pricing info from our API endpoint

Thanks!
Sarah`;

export function EmailInput({ onAnalyze, isLoading }: EmailInputProps) {
    const [text, setText] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (text.trim() && !isLoading) {
            onAnalyze(text.trim());
        }
    };

    const loadExample = () => {
        setText(EXAMPLE_EMAIL);
    };

    return (
        <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
                    <span className="text-2xl">📧</span>
                    Email / Task Input
                </h2>
                <button
                    onClick={loadExample}
                    className="text-sm text-accent-primary hover:text-accent-secondary transition-colors"
                    disabled={isLoading}
                >
                    Load Example
                </button>
            </div>

            <form onSubmit={handleSubmit}>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste your email, chat message, or task description here..."
                    className="input-textarea h-48 mb-4"
                    disabled={isLoading}
                />

                <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                        {text.length} characters
                    </p>

                    <button
                        type="submit"
                        disabled={!text.trim() || isLoading}
                        className={`
              glow-btn px-6 py-3 rounded-xl font-medium
              flex items-center gap-2 transition-all duration-300
              ${text.trim() && !isLoading
                                ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white hover:shadow-glow-md'
                                : 'bg-dark-600 text-gray-500 cursor-not-allowed'
                            }
            `}
                    >
                        {isLoading ? (
                            <>
                                <span className="spinner" />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Analyze & Generate Plan
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
