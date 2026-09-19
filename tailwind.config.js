export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Rockwell workspace theme — used in src/components/rockwell/**
        // Light theme matching the Rockwell chat dock (white + Rockota teal).
        // A dark variant can be layered on later.
        'rw-gold':       { DEFAULT: '#008080', dark: '#006666' }, // accent → teal (matches dock)
        'rw-surface':    { DEFAULT: '#eef5f3', light: '#f7faf9' }, // soft panel / hover
        'rw-navy':       { DEFAULT: '#243975', dark: '#1a2a54' },
        'rw-gray':       { DEFAULT: '#64748b', dark: '#475569' },  // muted text (readable on white)
        'rw-foreground': '#1f2a44',                                // ink text
        'rw-background': '#ffffff',                                // main surface (white)
        'rw-teal':       { DEFAULT: '#008080', dark: '#006666' },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}