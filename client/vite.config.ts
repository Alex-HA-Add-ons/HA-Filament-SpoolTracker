import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'

const rootPkg = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
) as { version?: string }

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
        '@pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
        '@modals': fileURLToPath(new URL('./src/modals', import.meta.url)),
        '@hooks': fileURLToPath(new URL('./src/hooks', import.meta.url)),
        '@services': fileURLToPath(new URL('./src/services', import.meta.url)),
        '@layouts': fileURLToPath(new URL('./src/layouts', import.meta.url)),
        '@utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
        '@styles': fileURLToPath(new URL('./src/styles', import.meta.url)),
      }
    },
    server: {
      port: parseInt(process.env.VITE_PORT || '5173'),
      proxy: isDev ? {
        '/api': {
          target: process.env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
        },
      } : undefined,
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    },
    // Home Assistant compatibility - use relative paths
    base: './',
    define: {
      __ADDON_VERSION__: JSON.stringify(
        process.env.ADDON_VERSION || rootPkg.version || '0.1.0'
      ),
    },
  }
})
