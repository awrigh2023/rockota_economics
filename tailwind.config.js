export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Rockwell workspace theme — used in src/components/rockwell/**
        // Dark panels (vault, notes, graph) use rw-surface/background/foreground.
        // Chat components use explicit white/gray values so they stay light.
        'rw-gold':       { DEFAULT: '#d7c770', dark: '#b8a850' },
        'rw-surface':    { DEFAULT: '#1a2744', light: '#223050' },
        'rw-navy':       { DEFAULT: '#243975', dark: '#1a2a54' },
        'rw-gray':       { DEFAULT: '#808080', dark: '#5a5a5a' },
        'rw-foreground': '#e2e8f0',
        'rw-background': '#0f1729',
        'rw-teal':       { DEFAULT: '#008080', dark: '#006666' },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}