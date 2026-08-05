import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: '#1A1C22',
        'surface-alt': '#23262F',
        border: '#2a2a2a',
        'border-glow': 'rgba(79,209,255,0.08)',
        primary: '#4FD1FF',
        'primary-glow': 'rgba(79,209,255,0.15)',
        warning: '#FFE500',
        danger: '#ef4444',
        success: '#4ADE80',
        'text-primary': '#E5E7EB',
        'text-muted': '#9CA3AF',
        'text-dim': '#444',
      },
      boxShadow: {
        'nb-sm': '2px 2px 0px rgba(79,209,255,0.5)',
        'nb-md': '3px 3px 0px rgba(79,209,255,0.5)',
        'nb-lg': '4px 4px 0px rgba(79,209,255,0.5)',
        'nb-yellow': '3px 3px 0px rgba(255,229,0,0.3)',
        card: '4px 4px 8px rgba(0,0,0,0.4), -2px -2px 6px rgba(255,255,255,0.03)',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
