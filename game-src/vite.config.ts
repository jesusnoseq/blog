import { defineConfig } from 'vite';

// The dev project lives outside Hugo's `static/` dir; the build output is written
// INTO `static/game` so Hugo publishes the playable game at `/game/`.
// `base: './'` keeps asset paths relative so the bundle is embeddable and can be
// opened directly from the filesystem. `emptyOutDir: false` is critical: it prevents
// the build from wiping the design docs (prompt.md / milestones.md / CLAUDE.md) that
// live alongside the output.
export default defineConfig({
  base: './',
  build: {
    outDir: '../static/game',
    emptyOutDir: false,
    assetsDir: 'assets',
  },
});
