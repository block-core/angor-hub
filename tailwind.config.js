/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: ['selector', '[data-theme="dark"]'], // Enable dark mode based on html attribute
  theme: {
    extend: {
      colors: {
        // Map CSS variables to Tailwind colors
        accent: 'var(--accent)',
        'accent-light': 'var(--accent-light)',
        'accent-dark': 'var(--accent-dark)',
        text: 'var(--text)',
        'text-secondary': 'var(--text-secondary)',
        'surface-card': 'var(--surface-card)',
        'surface-ground': 'var(--surface-ground)',
        'surface-hover': 'var(--surface-hover)',
        border: 'var(--border)',
        'header-bg': 'var(--header-bg)',
        'header-text': 'var(--header-text)',
        'bitcoin-mainnet': 'var(--bitcoin-mainnet)',
        'bitcoin-testnet': 'var(--bitcoin-testnet)',
        warning: 'var(--warning)',
        success: 'var(--success)',
        // Add background alias for convenience if needed
        background: 'var(--surface-ground)',
      },
      // Add custom animations or transitions if needed
      animation: {
        'float': 'floating 6s ease-in-out infinite',
        'spin-slow': 'spin 12s linear infinite',
        'spin-slower': 'spin 20s linear infinite reverse',
        'pulse-slow': 'pulsate 8s ease-in-out infinite',
      },
      keyframes: {
        floating: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        pulsate: {
          '0%, 100%': { opacity: 0.1 },
          '50%': { opacity: 0.3 },
        }
      }
    }
  },
  plugins: [
      require('@tailwindcss/typography'),
      require('tailwind-scrollbar-hide')
  ],
};
