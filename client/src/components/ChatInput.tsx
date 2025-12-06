import { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
    onSend: (message: string) => void;
    isLoading: boolean;
    placeholder?: string;
}

export function ChatInput({ onSend, isLoading, placeholder = "Ask me anything..." }: ChatInputProps) {
    const [message, setMessage] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    }, [message]);

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (message.trim() && !isLoading) {
            onSend(message.trim());
            setMessage('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    // Example prompts


    return (
        <div className="w-full">
            {/* Input area */}
            <form onSubmit={handleSubmit} className="relative">
                <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={isLoading}
                    rows={1}
                    className="w-full px-4 py-3 pr-14 bg-white border border-light-300 rounded-2xl
                     text-gray-800 placeholder-gray-400 resize-none
                     focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 focus:border-brand-indigo
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-200 shadow-soft"
                />
                <button
                    type="submit"
                    disabled={!message.trim() || isLoading}
                    className="absolute right-2 bottom-2 p-2.5 rounded-xl
                     bg-gradient-to-r from-brand-indigo to-brand-purple
                     text-white disabled:opacity-30 disabled:cursor-not-allowed
                     hover:shadow-lg hover:shadow-brand-indigo/30
                     transition-all duration-300"
                >
                    {isLoading ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    )}
                </button>
            </form>

            <p className="text-center text-xs text-gray-500 mt-2">
                Press <kbd className="px-1.5 py-0.5 bg-light-200 rounded border border-light-300 text-gray-700 font-mono text-xs">Enter</kbd> to send •
                <kbd className="px-1.5 py-0.5 bg-light-200 rounded border border-light-300 text-gray-700 font-mono text-xs ml-1">Shift+Enter</kbd> for new line •
                Safe Mode 🛡️
            </p>
        </div>
    );
}
