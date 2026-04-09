import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fbf7f1',
          100: '#f5ead6',
          200: '#ead3a9',
          300: '#dcb373',
          400: '#cc9446',
          500: '#b87a2e',
          600: '#9a6024',
          700: '#7a4a1f',
          800: '#573416',
          900: '#3b2310',
          950: '#1e1108',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Inter', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['ui-serif', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        soft: '0 10px 30px -12px rgba(0, 0, 0, 0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
