import { defineConfig } from "vite";

export default defineConfig({
  assetsInclude: ["**/windows-xp-wallpaper.jpg", "**/windows-xp-logo.png", "**/login-user-avatar.png", "**/tools"],
  server: {
    host: true,
    port: 5173
  }
});
