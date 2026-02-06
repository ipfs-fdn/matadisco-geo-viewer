export default {
  server: { port: 3000 },
  build: {
    outDir: "dist",
    target: "esnext",
  },
  css: {
    postcss: "./postcss.config.js",
  },
}
