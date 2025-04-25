/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}", // Scan HTML and TypeScript files
  ],
  theme: {
    extend: {
      colors: {
        // Define your project's color palette based on CSS variables
        'accent': 'var(--accent)',
        'accent-light': 'var(--accent-light)',
        'accent-dark': 'var(--accent-dark)',
        'text': 'var(--text)',
        'text-secondary': 'var(--text-secondary)',
        'surface-card': 'var(--surface-card)',
        'surface-ground': 'var(--surface-ground)',
        'surface-hover': 'var(--surface-hover)',
        'border': 'var(--border)',
        'header-bg': 'var(--header-bg)',
        'header-text': 'var(--header-text)',
        'bitcoin-mainnet': 'var(--bitcoin-mainnet)',
        'bitcoin-testnet': 'var(--bitcoin-testnet)',
        'warning': 'var(--warning)',
        'success': 'var(--success)',
        // Add other colors as needed
      },
      fontFamily: {
        // Define fonts if needed, e.g., Inter
        sans: ['Inter', 'sans-serif'],
      },
      // Extend other theme properties like spacing, borderRadius etc.
      borderRadius: {
        'card': '20px',
        'control': '10px',
        'badge': '24px',
      }
    },
  },
  plugins: [],
}
