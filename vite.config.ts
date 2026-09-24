import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const API_TARGET = process.env.API_TARGET ?? 'http://localhost:2027'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 2026,
    proxy: {
      '/api': API_TARGET,
      '/photos': API_TARGET,
    },
  },
  preview: {
    port: 2026,
    proxy: {
      '/api': API_TARGET,
      '/photos': API_TARGET,
    },
  },
})