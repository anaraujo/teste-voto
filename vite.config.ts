import { existsSync, readFileSync } from 'node:fs'
import { join, normalize, resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const API_TARGET = process.env.API_TARGET ?? 'http://localhost:2027'

/**
 * Serve o build como um host estático faria: primeiro a página pré-renderizada
 * de cada rota (`dist/<rota>/index.html`), e, quando ela não existe, o shell
 * vazio (`dist/app.html`), que é o que a hidratação assume.
 *
 * Sem este middleware o fallback SPA do Vite responderia antes e devolveria
 * sempre a home já pré-renderizada —inclusive para `/resultado`, o que quebraria
 * a hidratação.
 */
function prerenderedPages(): Plugin {
  const serve = (server: {
    middlewares: { use: (fn: Middleware) => void }
  }): void => {
    server.middlewares.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next()
        return
      }
      const pathname = decodeURIComponent(
        new URL(req.url ?? '/', 'http://localhost').pathname,
      )
      const distDir = join(process.cwd(), 'dist')
      const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
      const page =
        safe === '/'
          ? join(distDir, 'index.html')
          : join(distDir, safe, 'index.html')
      const file = existsSync(page) ? page : join(distDir, 'app.html')
      if (!file.startsWith(distDir) || !existsSync(file)) {
        next()
        return
      }
      const body = readFileSync(file)
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.setHeader('content-length', String(body.byteLength))
      res.end(req.method === 'HEAD' ? undefined : body)
    })
  }

  return {
    name: 'prerendered-pages',
    // Só no preview: em `npm start` o servidor de desenvolvimento precisa
    // servir o index.html fresco, senão um `dist/` antigo encobre a rota e
    // mudanças no código não aparecem.
    configurePreviewServer: serve,
  }
}

type Middleware = (
  req: { method?: string; url?: string },
  res: {
    setHeader: (name: string, value: string) => void
    end: (chunk?: unknown) => void
  },
  next: () => void,
) => void

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [prerenderedPages(), tailwindcss(), react()],
  resolve: {
    // Espelha o `paths` de tsconfig.app.json, para os componentes em
    // `src/components/ui/` importarem por `@/…`.
    alias: { '@': resolve(import.meta.dirname, 'src') },
  },
  // O manifest descreve os assets do shell; o build de páginas confere que
  // HTML pré-renderizado e bundle do cliente saem do mesmo build.
  build: isSsrBuild
    ? { outDir: 'dist-ssr', emptyOutDir: true, manifest: false }
    : { manifest: true },
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
}))
