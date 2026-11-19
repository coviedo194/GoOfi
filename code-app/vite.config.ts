import { defineConfig } from "vite";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { powerApps } from "@microsoft/power-apps-vite/plugin"

const projectDirectory = fileURLToPath(new URL(".", import.meta.url));
const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };
const gitSha = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
  cwd: projectDirectory,
  encoding: "utf8",
}).trim();
const isDirty = execFileSync("git", ["status", "--porcelain"], {
  cwd: projectDirectory,
  encoding: "utf8",
}).trim().length > 0;

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __GIT_SHA__: JSON.stringify(`${gitSha}${isDirty ? "-dirty" : ""}`),
  },
  plugins: [react(), powerApps()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Microsoft Fluent UI (componentes + iconos)
          // React/react-dom los provee el host runtime de Power Apps, por eso
          // se omiten del bundle (si los empaquetamos generan un chunk vacío).
          fluentui: [
            "@fluentui/react-components",
            "@fluentui/react-icons",
          ],
        },
      },
    },
  },
});
