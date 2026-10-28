import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Generates all PWA icon sizes from the single source SVG: `npm run icons`
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#b23c06' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#b23c06' } },
  },
  images: ['public/icon.svg'],
});
