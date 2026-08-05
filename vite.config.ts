import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    /* Same-origin /api in development, exactly like production — the Laravel
       dev server answers behind the proxy and cookies never cross an origin.
       Run with VITE_DATA_SOURCE unset (or =http) to use it. */
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
})
