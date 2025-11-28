/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        plex: {
          500: '#e5a00d',
          600: '#cc8e0b',
        },
        dark: {
          900: '#1a1a1a',
          800: '#262626',
          700: '#333333',
        }
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
      }
    },
  },
  plugins: [],
}