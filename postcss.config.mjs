// Tailwind CSS v4 is wired through PostCSS via its dedicated plugin. v4 is
// CSS-first: there is no tailwind.config.ts; design tokens live in app/globals.css
// under @theme (see DECISIONS.md D25). This is the native Next 16 + Turbopack
// pairing.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
