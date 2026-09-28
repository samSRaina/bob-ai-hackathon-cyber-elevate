/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#3e4c59',
          hover: '#323e49',
          active: '#28333c',
          soft: '#eef1f4',
        },
        surface: '#fafafa',
      },
      fontSize: {
        '2xs': ['11px', '16px'],
      },
      transitionDuration: {
        150: '150ms',
        200: '200ms',
      },
    },
  },
  plugins: [],
}
