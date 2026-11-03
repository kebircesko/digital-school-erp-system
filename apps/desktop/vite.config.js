import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  optimizeDeps: { include: ["@erp/shared/src/translate.cjs"] },
  build: {
    commonjsOptions: { include: [/node_modules/, /packages\/shared\//] },
  },
  server: { port: 5174, strictPort: true },
});
