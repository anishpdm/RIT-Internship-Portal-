/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          50: '#f7f6f3',
          100: '#ecebe5',
          200: '#d6d3c8',
          300: '#b6b1a1',
          400: '#8e8975',
          500: '#6e6957',
          600: '#534f42',
          700: '#3d3a31',
          800: '#262420',
          900: '#161512',
          950: '#0c0b09',
        },
        accent: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#d97706',
          600: '#b45309',
          700: '#92400e',
          800: '#78350f',
          900: '#451a03',
        },
      },
      boxShadow: {
        editorial: '0 1px 0 rgba(22,21,18,0.06), 0 0 0 1px rgba(22,21,18,0.06)',
      },
    },
  },
  plugins: [],
};
