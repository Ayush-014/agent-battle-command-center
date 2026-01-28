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
      },
    },
  },
  plugins: [],
};
