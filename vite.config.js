export default {
  // Use relative base so assets resolve correctly on GitHub Pages subpaths
  base: "./",
  server: { port: 3000 },
  build: {
    outDir: "dist",
    target: "esnext",
  },
  css: {
    postcss: "./postcss.config.js",
  },
}
