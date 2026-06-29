import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { explainApiPlugin } from "./server/vite-plugin.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    optimizeDeps: {
      include: ["react", "react-dom/client"],
    },
    server: {
      warmup: {
        clientFiles: ["./src/main.jsx"],
      },
    },
    plugins: [react(), explainApiPlugin({ env })],
  };
});
