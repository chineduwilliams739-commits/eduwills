import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#10233F',
        eduBlue: '#2457D6',
        eduCyan: '#26B7C9',
        eduGold: '#F4B942',
        paper: '#F7F9FC',
      },
      boxShadow: {
        soft: '0 20px 60px rgba(16, 35, 63, 0.10)',
      },
    },
  },
  plugins: [],
};

export default config;
