/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          darkest: '#090D16',
          dark: '#0D1322',
          panel: '#111827',
          border: '#1F2937',
          accent: '#06B6D4', // Cyan
          amber: '#F59E0B',  // Amber
          purple: '#8B5CF6'
        }
      }
    },
  },
  plugins: [],
}
