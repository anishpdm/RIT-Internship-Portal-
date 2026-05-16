/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          100: '#e2e8f0',
          200: '#e2e8f0',
          300: '#cbd5e1',
          500: '#64748b',
          700: '#334155',
          900: '#0f172a',
        },
        accent: {
          DEFAULT: '#4f46e5',
          hover: '#4338ca',
          soft: '#eef2ff',
        },
      },
      borderRadius: {
        DEFAULT: '10px',
        sm: '6px',
        lg: '14px',
      },
    },
  },
  plugins: [],
};
