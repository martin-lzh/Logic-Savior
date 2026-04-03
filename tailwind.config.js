// Tailwind CSS configuration — design system tokens, typography plugin overrides
import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          light: '#FFFFFF',
          dark: '#242424',
        },
        bg: {
          light: '#F9F9F8',
          dark: '#1A1A1A',
        },
        accent: {
          light: '#101010',
          dark: '#F5F5F5',
        },
      },
      fontFamily: {
        inter: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sourceSerif4: ['"Source Serif 4"', 'Georgia', 'ui-serif', 'serif'],
      },
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': theme('colors.accent.light'),
            '--tw-prose-headings': theme('colors.accent.light'),
            'h1, h2, h3, h4, h5, h6': {
              fontFamily: '"Source Serif 4", Georgia, ui-serif, serif',
            },
            'p, li, td, th, blockquote, span': {
              fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
              lineHeight: '1.75',
            },
            maxWidth: 'none',
          },
        },
        invert: {
          css: {
            '--tw-prose-body': theme('colors.accent.dark'),
            '--tw-prose-headings': theme('colors.accent.dark'),
          },
        },
      }),
    },
  },
  plugins: [typography],
}
