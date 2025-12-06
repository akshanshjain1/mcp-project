import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { Task } from './lib/types';
import { analyzePlan, streamExecuteTask, getMcpServers, addMcpServer } from './api/mcpClient';

interface Message {
    id: string;
    type: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    task?: Task;
    tasks?: Task[];
}

function App() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            type: 'system',
            content: '👋 Welcome to **Autonomous Workspace**! I can help you with file operations, searching the web, scheduling events, and more. Just tell me what you need.',
            timestamp: new Date(),
        },
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [mcpServers, setMcpServers] = useState<string[]>([]);
    const [selectedMcp, setSelectedMcp] = useState<string>(''); // Empty means use all available
    const [newMcp, setNewMcp] = useState<string>('');
    const [showMcpSelector, setShowMcpSelector] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
        // Load from localStorage or default to 320px
        return parseInt(localStorage.getItem('sidebarWidth') || '320');
    });
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
    const mcpSelectorRef = useRef<HTMLDivElement>(null);
    const resizeHandleRef = useRef<HTMLDivElement>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);


    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLDivElement>(null);

    // Always stay at bottom during generation, scroll to input when idle
    useEffect(() => {
        const scrollToBottom = () => {
            // Check if any tasks are currently executing or have results (active generation)
            const hasActiveTasks = messages.some(msg =>
                msg.task && (msg.task.status === 'executing' || msg.task.status === 'pending' || (msg.task.result && msg.task.result.length > 0))
            );

            if (hasActiveTasks) {
                // During any task activity, ALWAYS stay at bottom to see generation/results
                if (messagesEndRef.current) {
                    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
                }
            } else {
                // Only when completely idle, scroll to show the input area
                // This gives a nice overview of the conversation
                setTimeout(() => {
                    if (chatInputRef.current && !messages.some(msg => msg.task?.status === 'executing')) {
                        const chatInputTop = chatInputRef.current.offsetTop;
                        const mainElement = document.querySelector('main');
                        if (mainElement) {
                            mainElement.scrollTo({
                                top: chatInputTop - 20,
                                behavior: 'smooth'
                            });
                        }
                    }
                }, 500); // Delay to ensure no generation is happening
            }
        };

        const timer = setTimeout(scrollToBottom, 100);
        return () => clearTimeout(timer);
    }, [messages, messages.map(m => m.task?.result || m.task?.status).join('')]);

    // Close MCP selector when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (mcpSelectorRef.current && !mcpSelectorRef.current.contains(event.target as Node)) {
                setShowMcpSelector(false);
            }
        };
        if (showMcpSelector) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showMcpSelector]);

    // Resize functionality
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;

            const newWidth = Math.max(200, Math.min(600, e.clientX));
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            localStorage.setItem('sidebarWidth', sidebarWidth.toString());
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, sidebarWidth]);


    useEffect(() => {
        getMcpServers().then((domains) => {
            setMcpServers(domains);
            // Restore selection from localStorage, empty means use all available
            const stored = localStorage.getItem('selectedMcp');
            setSelectedMcp(stored && domains.includes(stored) ? stored : '');
        });
    }, []);

    const addMessage = (msg: Omit<Message, 'id' | 'timestamp'>) => {
        setMessages(prev => [...prev, {
            ...msg,
            id: `msg-${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
        }]);
    };

    const updateTaskInMessages = (taskId: string, updates: Partial<Task>) => {
        setMessages(prev => prev.map(msg => {
            if (msg.task?.id === taskId) {
                return { ...msg, task: { ...msg.task, ...updates } };
            }
            return msg;
        }));
    };

    const handleSend = async (text: string) => {
        // Add user message
        addMessage({ type: 'user', content: text });

        // Show loading
        setIsLoading(true);
        const loadingMsgId = `loading-${Date.now()}`;
        setMessages(prev => [...prev, {
            id: loadingMsgId,
            type: 'assistant',
            content: '',
            timestamp: new Date(),
        }]);

        try {
            // Analyze the request
            const plan = await analyzePlan(text);

            // Remove loading message
            setMessages(prev => prev.filter(m => m.id !== loadingMsgId));

            // Add summary message
            addMessage({
                type: 'assistant',
                content: `📋 **${plan.summary}**\n\nI've identified **${plan.tasks.length} task(s)**. Executing automatically...`,
            });

            // Add task cards
            for (const task of plan.tasks) {
                addMessage({
                    type: 'assistant',
                    content: '',
                    task,
                });
            }

            // Execute tasks sequentially (one after another)
            executeTasksSequentially(plan.tasks);

        } catch (error) {
            // Remove loading message
            setMessages(prev => prev.filter(m => m.id !== loadingMsgId));

            addMessage({
                type: 'assistant',
                content: `❌ **Error:** ${error instanceof Error ? error.message : 'Something went wrong. Please try again.'}`,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const executeTaskInternal = (task: Task): Promise<void> => {
        return new Promise((resolve, reject) => {
            // Update task status to executing
            updateTaskInMessages(task.id, { status: 'executing', result: '' });

            // Start streaming execution
            streamExecuteTask({
                taskId: task.id,
                tool: task.tool,
                payload: task.payload,
                description: task.description,
            }, (event) => {
                switch (event.type) {
                    case 'start':
                        break;
                    case 'log':
                        setMessages(prev => prev.map(msg => {
                            if (msg.task?.id === task.id) {
                                return {
                                    ...msg,
                                    task: {
                                        ...msg.task,
                                        logs: [...(msg.task.logs || []), event.data.message]
                                    }
                                };
                            }
                            return msg;
                        }));
                        break;
                    case 'tool_result':
                        break;
                    case 'summary_chunk':
                        setMessages(prev => prev.map(msg => {
                            if (msg.task?.id === task.id) {
                                return {
                                    ...msg,
                                    task: {
                                        ...msg.task,
                                        result: (msg.task.result || '') + event.data.content
                                    }
                                };
                            }
                            return msg;
                        }));
                        break;
                    case 'done':
                        updateTaskInMessages(task.id, { status: 'success' });
                        resolve();
                        break;
                    case 'error':
                        updateTaskInMessages(task.id, {
                            status: 'failed',
                            error: event.data.message
                        });
                        reject(new Error(event.data.message));
                        break;
                }
            });
        });
    };

    const executeTasksSequentially = async (tasks: Task[]) => {
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            try {
                // Wait for previous task to complete before starting next
                await executeTaskInternal(task);
                // Small delay between tasks for better UX
                if (i < tasks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            } catch (error) {
                console.error(`Task ${task.id} failed:`, error);
                // Continue with next task even if current one fails
            }
        }
    };

    const handleApproveTask = (task: Task) => {
        // Auto-execute all tasks
        executeTaskInternal(task);
    };

    const handleSelectMcp = (domain: string) => {
        setSelectedMcp(domain);
        if (domain) {
            localStorage.setItem('selectedMcp', domain);
        } else {
            localStorage.removeItem('selectedMcp'); // Empty means use all available
        }
    };
    const handleAddMcp = async () => {
        if (!newMcp.trim()) return;
        try {
            const domains = await addMcpServer(newMcp.trim());
            setMcpServers(domains);
            // Optionally select the newly added domain, or keep "All Available"
            setNewMcp('');
        } catch (err) {
            alert('Failed to add MCP server: ' + (err instanceof Error ? err.message : String(err)));
        }
    };

    return (
        <div className="h-screen flex flex-col bg-gradient-to-br from-light-100 via-white to-light-200">
            {/* Floating MCP Panel */}
            {isSidebarOpen && (
                <div className="fixed inset-0 z-40">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                        onClick={() => setIsSidebarOpen(false)}
                    />

                    {/* Sidebar Panel */}
                    <div
                        ref={sidebarRef}
                        className={`absolute top-0 left-0 h-full bg-white/95 backdrop-blur-xl border-r border-light-300 shadow-2xl transition-all duration-300 ${
                            isResizing ? 'select-none' : ''
                        }`}
                        style={{ width: `${sidebarWidth}px` }}
                    >
                        {/* Sidebar Header */}
                        <div className="flex items-center justify-between p-4 border-b border-light-300/50">
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-gradient-to-r from-brand-indigo to-brand-purple rounded-lg blur opacity-30"></div>
                                    <div className="relative w-6 h-6 bg-gradient-to-br from-brand-indigo to-brand-purple rounded-lg flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                                        </svg>
                                    </div>
                                </div>
                                <span className="text-sm font-semibold text-gray-700">MCP Servers</span>
                            </div>

                            <button
                                onClick={() => setIsSidebarOpen(false)}
                                className="w-6 h-6 rounded-md hover:bg-gray-100 flex items-center justify-center transition-colors"
                                title="Close Sidebar"
                            >
                                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Sidebar Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Select Dropdown */}
                            <div className="space-y-2">
                                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">
                                    Server
                                </label>
                                <div className="relative">
                                    <select
                                        value={selectedMcp}
                                        onChange={e => handleSelectMcp(e.target.value)}
                                        className="w-full px-3 py-2 bg-white/90 border border-light-300 rounded-lg text-sm text-gray-700 font-medium
                                            focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 focus:border-brand-indigo
                                            transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer appearance-none"
                                    >
                                        <option value="">✨ Auto</option>
                                        {mcpServers.map(domain => (
                                            <option key={domain} value={domain}>{domain}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <svg className="w-4 h-4 text-brand-indigo" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                                {!selectedMcp && (
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                        Auto-selecting
                                    </p>
                                )}
                            </div>

                            {/* Add New Input */}
                            <div className="space-y-2">
                                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">
                                    Add Domain
                                </label>
                                <div className="flex gap-1.5">
                                    <input
                                        type="text"
                                        value={newMcp}
                                        onChange={e => setNewMcp(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddMcp()}
                                        placeholder="api.example.com"
                                        className="flex-1 px-3 py-2 bg-white/90 border border-light-300 rounded-lg text-sm text-gray-700 placeholder-gray-400
                                            focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 focus:border-brand-indigo
                                            transition-all duration-200 shadow-sm hover:shadow-md font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddMcp}
                                        disabled={!newMcp.trim()}
                                        className="px-3 py-2 bg-gradient-to-r from-brand-indigo to-brand-purple text-white rounded-lg text-sm font-semibold
                                            hover:shadow-lg hover:shadow-brand-indigo/30 disabled:opacity-50 disabled:cursor-not-allowed
                                            transition-all duration-300 flex items-center justify-center"
                                        title="Add MCP Server"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Status Badge */}
                            <div className="pt-3 border-t border-light-300/50">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                    <span className="text-xs font-medium text-gray-600">
                                        {mcpServers.length} {mcpServers.length === 1 ? 'Server' : 'Servers'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Resize Handle */}
                        <div
                            ref={resizeHandleRef}
                            className={`absolute top-0 right-0 w-1 h-full bg-gray-200 hover:bg-brand-indigo transition-colors cursor-col-resize ${
                                isResizing ? 'bg-brand-indigo' : ''
                            }`}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                setIsResizing(true);
                            }}
                        >
                            <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 flex items-center">
                                <div className="w-0.5 h-6 bg-gray-400 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="flex-shrink-0 border-b border-white/50 bg-white/60 backdrop-blur-2xl shadow-sm sticky top-0 z-30">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                                <div className="relative group flex-shrink-0">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-brand-indigo via-purple-500 to-pink-500 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                                    <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white flex items-center justify-center shadow-sm border border-white/50">
                                        <span className="text-xl sm:text-2xl transform group-hover:scale-110 transition-transform duration-300">✨</span>
                                    </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h1 className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-brand-indigo to-brand-purple tracking-tight truncate">Autonomous Workspace</h1>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0"></span>
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider truncate">Online & Ready</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 ml-4">
                                {/* MCP Toggle Button */}
                                <button
                                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                    className="w-10 h-10 rounded-xl bg-white border border-light-300 shadow-sm hover:shadow-md
                                        flex items-center justify-center transition-all duration-200 hover:scale-105
                                        focus:outline-none focus:ring-2 focus:ring-brand-indigo/50"
                                    title="MCP Server Settings"
                                >
                                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                                    </svg>
                                </button>

                                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/50 border border-white/60 shadow-sm backdrop-blur-md">
                                    <span className="text-xs font-medium text-gray-600">Safe Mode</span>
                                    <div className="w-8 h-4 bg-green-100 rounded-full p-0.5 flex items-center">
                                        <div className="w-3 h-3 bg-green-500 rounded-full shadow-sm ml-auto"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Messages */}
                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
                        {messages.map((msg) => (
                            <ChatMessage
                                key={msg.id}
                                type={msg.type}
                                content={msg.content}
                                timestamp={msg.timestamp}
                                task={msg.task}
                                onApprove={handleApproveTask}
                                isLoading={msg.id.startsWith('loading-')}
                            />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                </main>

                {/* Chat Input */}
                <div ref={chatInputRef} className="border-t border-light-300 bg-transparent p-3 sm:p-4">
                    <div className="max-w-6xl mx-auto">
                        <ChatInput
                            onSend={handleSend}
                            isLoading={isLoading}
                            placeholder="What would you like me to help with?"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
