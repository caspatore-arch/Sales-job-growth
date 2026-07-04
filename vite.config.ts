import { defineConfig } from 'vite'

// Serve from /Sales-job-growth/ on GitHub Pages, / everywhere else
export default defineConfig(({ command }) => ({
  base: command === 'build' && process.env.GITHUB_PAGES ? '/Sales-job-growth/' : '/',
}))
