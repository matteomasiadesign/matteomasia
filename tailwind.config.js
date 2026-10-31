/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // Doto: solo per i titoli (vedi h1/h2/h3 in index.css)
        display: ['Doto', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
