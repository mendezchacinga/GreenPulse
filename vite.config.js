const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");
const tailwindcss = require("@tailwindcss/vite").default;

module.exports = defineConfig({
    root: "frontend",
    plugins: [react(), tailwindcss()],
    server: {
        port: 5173,
        strictPort: true,
        proxy: {
            "/api": "http://localhost:3000",
        },
    },
    preview: {
        port: 4173,
        strictPort: true,
    },
});
