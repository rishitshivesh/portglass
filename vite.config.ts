import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(
      JSON.parse(
        readFileSync(new URL("./package.json", import.meta.url), "utf8"),
      ).version,
    ),
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { host: "127.0.0.1", port: 1420, strictPort: true },
  clearScreen: false,
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Base UI's RSC directives do not apply to this desktop-only SPA.
        if (
          warning.code === "MODULE_LEVEL_DIRECTIVE" &&
          warning.message.includes('"use client"')
        )
          return;
        warn(warning);
      },
    },
  },
});
