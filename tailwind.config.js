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
      keyframes: {
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-10%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      },
      animation: {
        'fade-in-down': 'fade-in-down 0.2s ease-out',
        'slide-down': 'slide-down 0.2s ease-out',
      },
      // Add scrollbar-hide utility if not present via plugin
      // (Requires tailwind-scrollbar-hide plugin or custom CSS)
      // Example custom CSS would be in styles.css:
      // .scrollbar-hide::-webkit-scrollbar { display: none; }
      // .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    },
  },
  plugins: [
      require('@tailwindcss/typography'), // For prose styling
      require('tailwind-scrollbar-hide') // Optional: if you need scrollbar hiding utility
  ],
};
