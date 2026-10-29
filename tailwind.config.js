/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#080D18',
        secondary: '#101827',
        card: '#151F30',
        cardHover: '#1B273D',
        accent: '#B8F34A',
        accentHover: '#A4DE3F',
        success: '#35D07F',
        warning: '#FFB84D',
        danger: '#FF5D67',
        textMain: '#F5F7FA',
        muted: '#94A3B8',
        borderSubtle: '#223048',
        borderStrong: '#334766',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      boxShadow: {
        'glow-accent': '0 0 20px -3px rgba(184, 243, 74, 0.25)',
        'glow-success': '0 0 20px -3px rgba(53, 208, 127, 0.25)',
        'glow-danger': '0 0 20px -3px rgba(255, 93, 103, 0.25)',
      }
    },
  },
  plugins: [],
}
