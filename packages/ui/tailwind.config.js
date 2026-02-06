/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Strategy game inspired dark theme
        'command': {
          bg: '#0a0e14',
          panel: '#141a22',
          border: '#1e2836',
          accent: '#2d3b4f',
        },
        'hud': {
          green: '#00ff88',
          blue: '#00aaff',
          amber: '#ffaa00',
          red: '#ff4444',
          purple: '#aa55ff',
        },
        'agent': {
          coder: '#3B82F6',
          qa: '#10B981',
        },
        'status': {
          pending: '#6B7280',
          assigned: '#8B5CF6',
          active: '#3B82F6',
          stuck: '#F59E0B',
          completed: '#10B981',
          failed: '#EF4444',
        },
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
        'display': ['Orbitron', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan': 'scan 2s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'radar-sweep': 'radar-rotate 4s linear infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'scale-pulse': 'scale-pulse 0.4s ease-out',
        'shake': 'shake 0.5s ease-in-out',
        'border-flash-green': 'border-flash-green 0.5s ease-out',
        'border-flash-red': 'border-flash-red 0.5s ease-out',
        'warning-blink': 'warning-blink 1s linear infinite',
        'glow-pulse-blue': 'glow-pulse-blue 2s ease-in-out infinite',
        'glow-pulse-amber': 'glow-pulse-amber 1.5s ease-in-out infinite',
      },
      keyframes: {
        scan: {
          '0%, 100%': { opacity: 0.5 },
          '50%': { opacity: 1 },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px currentColor' },
          '100%': { boxShadow: '0 0 20px currentColor, 0 0 30px currentColor' },
        },
        'radar-rotate': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'slide-in': {
          '0%': { opacity: 0, transform: 'translateX(-10px)' },
          '100%': { opacity: 1, transform: 'translateX(0)' },
        },
        'slide-up': {
          '0%': { opacity: 0, transform: 'translateY(10px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        'scale-pulse': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-2px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(2px)' },
        },
        'border-flash-green': {
          '0%': { borderColor: 'rgba(16, 185, 129, 0.5)' },
          '50%': { borderColor: 'rgba(16, 185, 129, 1)' },
          '100%': { borderColor: 'rgba(16, 185, 129, 0.5)' },
        },
        'border-flash-red': {
          '0%': { borderColor: 'rgba(239, 68, 68, 0.5)' },
          '50%': { borderColor: 'rgba(239, 68, 68, 1)' },
          '100%': { borderColor: 'rgba(239, 68, 68, 0.5)' },
        },
        'warning-blink': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        'glow-pulse-blue': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(59, 130, 246, 0.3)' },
          '50%': { boxShadow: '0 0 15px rgba(59, 130, 246, 0.6), 0 0 25px rgba(59, 130, 246, 0.3)' },
        },
        'glow-pulse-amber': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(245, 158, 11, 0.3)' },
          '50%': { boxShadow: '0 0 15px rgba(245, 158, 11, 0.6), 0 0 25px rgba(245, 158, 11, 0.3)' },
        },
      },
    },
  },
  plugins: [],
};
