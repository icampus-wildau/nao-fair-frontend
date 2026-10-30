import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import ui from "@nuxt/ui/vite"

export default defineConfig({
  plugins: [
    vue(),
    ui({
      colorMode: false,
      ui: {
        colors: {
          primary: "neutral",
          neutral: "zinc",
        },
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.NAO_FAIR_API_URL || "http://127.0.0.1:8000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
