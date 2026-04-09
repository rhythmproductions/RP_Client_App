import type { Config } from 'tailwindcss';

/**
 * Rhythm Productions palette.
 *
 * `brand` is a neutral grey scale used for backgrounds, borders and
 * text (white → near-black). `accent` is the red pulled from the
 * Rhythm Productions logo and is used for primary actions, focus
 * states and key UI highlights.
 */
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b',
        },
        accent: {
          50: '#fff1f1',
          100: '#ffe0e0',
          200: '#ffc4c4',
          300: '#ff9a9a',
          400: '#f95555',
          500: '#e52933',
          600: '#d9232b',
          700: '#b01a22',
          800: '#8f171e',
          900: '#761820',
          950: '#400a0d',
        },
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Inter',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        display: [
          'Impact',
          'Oswald',
          'Arial Black',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      boxShadow: {
        soft: '0 10px 30px -12px rgba(24, 24, 27, 0.18)',
        card: '0 1px 2px rgba(24, 24, 27, 0.04), 0 8px 24px -12px rgba(24, 24, 27, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
