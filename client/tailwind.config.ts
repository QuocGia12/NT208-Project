import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      screens: {
        'mobile-l': '568px',
        'tablet-l': '768px',
        'desktop-sm': '1024px',
        desktop: '1280px',
        'desktop-xl': '1920px'
      }
    }
  },
  plugins: []
};

export default config;
