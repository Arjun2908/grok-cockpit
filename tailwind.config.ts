import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'SF Pro Text', 'sans-serif'],
        mono: ['ui-monospace', 'SF Mono', 'Menlo', 'monospace']
      }
    }
  },
  plugins: []
}

export default config
