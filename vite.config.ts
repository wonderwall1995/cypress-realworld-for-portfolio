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
      // The browser (or a WebView) only ever talks to this origin; "/api" is forwarded to Express
      proxy: {
        "/api": {
          target: `http://localhost:${env.VITE_BACKEND_PORT || 7202}`,
        },
      },
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
      setupFiles: ["./src/setup-tests.js", "./src/__tests__/db-setup/env.ts"],
      globalSetup: "./src/__tests__/db-setup/global.ts",
      exclude: ["node_modules", "e2e", "dist"],
      fileParallelism: false, // run test files one at a time: they share one test database
    },
  };
});
