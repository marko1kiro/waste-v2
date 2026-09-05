import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // TailAdmin brand scale (#465fff core)
        'brand-25': '#f2f7ff',
        'brand-50': '#ecf3ff',
        'brand-100': '#dde9ff',
        'brand-200': '#c2d6ff',
        'brand-300': '#9cb9ff',
        'brand-400': '#7592ff',
        'brand-500': '#465fff',
        'brand-600': '#3641f5',
        'brand-700': '#2a31d8',
        'brand-800': '#252dae',
        'brand-900': '#262e89',
        'brand-950': '#161950',

        // TailAdmin gray scale (#101828 core)
        'gray-25': '#fcfcfd',
        'gray-50': '#f9fafb',
        'gray-100': '#f2f4f7',
        'gray-200': '#e4e7ec',
        'gray-300': '#d0d5dd',
        'gray-400': '#98a2b3',
        'gray-500': '#667085',
        'gray-600': '#475467',
        'gray-700': '#344054',
        'gray-800': '#1d2939',
        'gray-900': '#101828',
        'gray-950': '#0c111d',

        // TailAdmin success scale
        'success-25': '#f6fef9',
        'success-50': '#ecfdf3',
        'success-100': '#d1fadf',
        'success-200': '#a6f4c5',
        'success-300': '#6ce9a6',
        'success-400': '#32d583',
        'success-500': '#12b76a',
        'success-600': '#039855',
        'success-700': '#027a48',
        'success-800': '#05603a',
        'success-900': '#054f31',
        'success-950': '#053321',

        // TailAdmin error scale
        'error-25': '#fffbfa',
        'error-50': '#fef3f2',
        'error-100': '#fee4e2',
        'error-200': '#fecdca',
        'error-300': '#fda29b',
        'error-400': '#f97066',
        'error-500': '#f04438',
        'error-600': '#d92d20',
        'error-700': '#b42318',
        'error-800': '#912018',
        'error-900': '#7a271a',
        'error-950': '#55160c',

        // TailAdmin warning scale
        'warning-25': '#fffcf5',
        'warning-50': '#fffaeb',
        'warning-100': '#fef0c7',
        'warning-200': '#fedf89',
        'warning-300': '#fec84b',
        'warning-400': '#fdb022',
        'warning-500': '#f79009',
        'warning-600': '#dc6803',
        'warning-700': '#b54708',
        'warning-800': '#93370d',
        'warning-900': '#7a2e0e',
        'warning-950': '#4e1d09',

        // TailAdmin orange scale
        'orange-25': '#fffaf5',
        'orange-50': '#fff6ed',
        'orange-100': '#ffead5',
        'orange-200': '#fddcab',
        'orange-300': '#feb273',
        'orange-400': '#fd853a',
        'orange-500': '#fb6514',
        'orange-600': '#ec4a0a',
        'orange-700': '#c4320a',
        'orange-800': '#9c2a10',
        'orange-900': '#7e2410',
        'orange-950': '#511c10',

        // TailAdmin blue-light scale
        'blue-light-25': '#f5fbff',
        'blue-light-50': '#f0f9ff',
        'blue-light-100': '#e0f2fe',
        'blue-light-200': '#b9e6fe',
        'blue-light-300': '#7cd4fd',
        'blue-light-400': '#36bffa',
        'blue-light-500': '#0ba5ec',
        'blue-light-600': '#0086c9',
        'blue-light-700': '#026aa2',
        'blue-light-800': '#065986',
        'blue-light-900': '#0b4a6f',
        'blue-light-950': '#062c41',

        // Semantic tokens — flip per mode via CSS variables
        background: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-alt': 'rgb(var(--surface-alt) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        'text-primary': 'rgb(var(--text-primary) / <alpha-value>)',
        'text-muted': 'rgb(var(--text-muted) / <alpha-value>)',
        'text-dim': 'rgb(var(--text-dim) / <alpha-value>)',
      },
      boxShadow: {
        'theme-xs': '0px 1px 2px 0px rgba(16, 24, 40, 0.05)',
        'theme-sm': '0px 1px 3px 0px rgba(16, 24, 40, 0.1), 0px 1px 2px 0px rgba(16, 24, 40, 0.06)',
        'theme-md': '0px 4px 8px -2px rgba(16, 24, 40, 0.1), 0px 2px 4px -2px rgba(16, 24, 40, 0.06)',
        'theme-lg': '0px 12px 16px -4px rgba(16, 24, 40, 0.08), 0px 4px 6px -2px rgba(16, 24, 40, 0.03)',
        'theme-xl': '0px 20px 24px -4px rgba(16, 24, 40, 0.08), 0px 8px 8px -4px rgba(16, 24, 40, 0.03)',
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
