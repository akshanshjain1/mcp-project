/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Light theme colors
                light: {
                    50: '#ffffff',
                    100: '#f8fafc',
                    200: '#f1f5f9',
                    300: '#e2e8f0',
                    400: '#cbd5e1',
                    500: '#94a3b8',
                },
                // Keep dark for potential dark mode toggle
                dark: {
                    900: '#0a0a0f',
                    800: '#12121a',
                    700: '#1a1a26',
                    600: '#242433',
                    500: '#2e2e40',
                },
                accent: {
                    primary: '#6366f1',
                    secondary: '#8b5cf6',
                    success: '#10b981',
                    warning: '#f59e0b',
                    danger: '#ef4444',
                },
                // Modern gradient colors
                brand: {
                    blue: '#3b82f6',
                    indigo: '#6366f1',
                    purple: '#8b5cf6',
                    pink: '#ec4899',
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            boxShadow: {
                'soft': '0 2px 15px -3px rgba(0,0,0,0.07), 0 10px 20px -2px rgba(0,0,0,0.04)',
                'card': '0 0 0 1px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.05), 0 12px 24px rgba(0,0,0,0.05)',
                'glow-blue': '0 0 20px rgba(59, 130, 246, 0.3)',
                'glow-purple': '0 0 20px rgba(139, 92, 246, 0.3)',
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'gradient': 'gradient 8s ease infinite',
                'float': 'float 6s ease-in-out infinite',
                'slide-up': 'slideUp 0.4s ease-out',
            },
            keyframes: {
                gradient: {
                    '0%, 100%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'mesh-gradient': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            },
        },
    },
    plugins: [],
}
