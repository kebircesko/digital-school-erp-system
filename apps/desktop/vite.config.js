import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  optimizeDeps: { exclude: ["@erp/shared/src/translate.mjs"] },
  build: {
    commonjsOptions: { include: [/node_modules/, /packages\/shared\//] },
  },
  server: { port: 5174, strictPort: true },
});
