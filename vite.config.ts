import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import eslint from "vite-plugin-eslint";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE");
  return {
    // expose all vite "VITE_*" variables as process.env.VITE_* in the browser
    define: {
      "process.env": env,
    },
    server: {
      port: Number(loadEnv(mode, process.cwd(), "PORT").PORT) || 7201,
    },
    build: {
      outDir: "build",
      sourcemap: true,
    },
    plugins: [react(), eslint()],
    // to get aws amplify to work with vite
    resolve: {
      alias: [
        {
          find: "./runtimeConfig",
          replacement: "./runtimeConfig.browser", // ensures browser compatible version of AWS JS SDK is used
        },
      ],
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/setup-tests.js",
      exclude: ["node_modules", "e2e", "dist"],
      fileParallelism: false, // #1666: Run tests sequentially to avoid race conditions with shared database.json file.
    },
  };
});
