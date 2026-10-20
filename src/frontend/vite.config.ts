import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// `npm run dev` memproksi /api ke server Python (python server.py, port 8000)
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
});
