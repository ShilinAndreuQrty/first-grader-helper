import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const appVariant = mode === 'admin' ? 'admin' : 'public'
  return {
    envDir: '..',
    plugins: [
      react(),
      {
        name: 'select-app-entry',
        transformIndexHtml: {
          order: 'pre',
          handler(html: string) {
            return appVariant === 'admin'
              ? html.replace('/src/main.public.tsx', '/src/main.admin.tsx')
              : html
          },
        },
      },
    ],
    define: {
      'import.meta.env.VITE_APP_VARIANT': JSON.stringify(appVariant),
    },
    build: {
      outDir: `dist/${appVariant}`,
    },
    server: {
      port: appVariant === 'admin' ? 5174 : 5173,
      allowedHosts: [
        '.trycloudflare.com',
      ],
      proxy: {
        '/api': 'http://localhost:8000',
        '/health': 'http://localhost:8000',
        '/ready': 'http://localhost:8000',
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      globals: true,
      css: true,
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }
})
