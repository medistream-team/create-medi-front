import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import StylelintPlugin from "vite-plugin-stylelint";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), StylelintPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
