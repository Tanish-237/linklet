import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
    tailwindcss()
  ],
  server: {
    port: 5173
  },
  // Only affects `vite build --ssr` (scripts/prerender.mjs's build-time
  // render step), not the client build below. react-helmet-async ships as
  // CJS; left external, its `import { Helmet }` re-emits verbatim into the
  // SSR bundle and Node's ESM loader can't resolve the named export.
  // Bundling it lets Vite apply its own CJS interop instead.
  ssr: {
    noExternal: ['react-helmet-async'],
  },
})
