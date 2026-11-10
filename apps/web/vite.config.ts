import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import eslint from "vite-plugin-eslint";

export default defineConfig(({ mode }) => {
  // The repository keeps one .env at its root, shared by the web app and the API
  const rootDir = path.resolve(__dirname, "../..");
  const env = loadEnv(mode, rootDir, "VITE");
  return {
    envDir: rootDir,
    // expose all vite "VITE_*" variables as process.env.VITE_* in the browser
    define: {
      "process.env": env,
    },
    server: {
      port: Number(loadEnv(mode, rootDir, "PORT").PORT) || 7201,
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
  };
});
