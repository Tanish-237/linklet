import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Long-lived, rarely-changing libraries get their own chunks. Their filenames only
// change when the library itself is upgraded, so after an app deploy the browser
// re-downloads just the (small) app code instead of the whole bundle. Only applies
// to the client build; the SSR/prerender build stays a single file.
const VENDOR_CHUNKS = [
  ['react-vendor', ['/node_modules/react/', '/node_modules/react-dom/', '/node_modules/scheduler/', '/node_modules/react-router', '/node_modules/@remix-run/']],
  ['query-vendor', ['/node_modules/@tanstack/']],
  ['ui-vendor', ['/node_modules/sonner/', '/node_modules/react-helmet-async/', '/node_modules/react-intersection-observer/']],
]

const manualChunks = (id) => {
  if (!id.includes('/node_modules/')) return undefined
  for (const [chunk, needles] of VENDOR_CHUNKS) {
    if (needles.some((needle) => id.includes(needle))) return chunk
  }
  return undefined
}

// https://vite.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(),
    tailwindcss()
  ],
  server: {
    port: 5173
  },
  build: {
    rollupOptions: {
      output: isSsrBuild ? {} : { manualChunks },
    },
  },
  // Only affects `vite build --ssr` (scripts/prerender.mjs's build-time
  // render step), not the client build below. react-helmet-async ships as
  // CJS; left external, its `import { Helmet }` re-emits verbatim into the
  // SSR bundle and Node's ESM loader can't resolve the named export.
  // Bundling it lets Vite apply its own CJS interop instead.
  ssr: {
    noExternal: ['react-helmet-async'],
  },
}))
