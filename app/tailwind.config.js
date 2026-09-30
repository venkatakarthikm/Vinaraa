/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A18',
        surface: '#14142B',
        'surface-2': '#1D1D3A',
        border: '#2A2A4A',
        text: '#F4F3FF',
        muted: '#9A98BD',
        primary: '#8B3DFF',
        'primary-soft': '#B57BFF',
        accent: '#FF3D8E',
        mint: '#2DE1B5',
        amber: '#FFC247',
        danger: '#FF5470',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        display: ['Sora', 'sans-serif'],
      },
      borderRadius: {
        'card': '24px',
        'sheet': '32px',
        'artwork': '24px',
      },
      boxShadow: {
        'colored': '0 20px 40px -20px rgba(139,61,255,0.45)',
      },
    },
  },
  plugins: [],
}
