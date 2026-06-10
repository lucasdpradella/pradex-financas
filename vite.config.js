import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Pradex Finanças',
        short_name: 'Pradex',
        description: 'Seu planejamento financeiro inteligente',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0F1117',
        theme_color: '#0F1117',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache só do shell (build assets). Nada do Supabase passa pelo cache:
        // dado financeiro é sempre network (cross-origin fica fora do SW por padrão).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/rest\//, /^\/functions\//],
      },
    }),
  ],
  publicDir: 'public',
})
