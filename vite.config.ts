import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use absolute base so built assets have full GitHub Pages URLs
  // If deploying to a project page like yuriiti.github.io/snake/, set base to '/snake/' instead
  base: "https://yuriiti.github.io/snake_app/",
  build: {
    // Output to docs/ for GitHub Pages
    outDir: "docs",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    open: false,
  },
  preview: {
    port: 5173,
  },
});
