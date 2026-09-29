/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface-container-high": "#222a3d",
        "surface-bright": "#31394d",
        "on-secondary-fixed-variant": "#3c475a",
        "tertiary-container": "#a15100",
        "surface-container-lowest": "#060e20",
        "surface-variant": "#2d3449",
        "secondary": "#bcc7de",
        "outline-variant": "#4a4455",
        "on-secondary-fixed": "#111c2d",
        "background": "#0b1326",
        "error-container": "#93000a",
        "outline": "#958da1",
        "on-tertiary-fixed-variant": "#713700",
        "on-error": "#690005",
        "on-surface-variant": "#ccc3d8",
        "on-tertiary-fixed": "#301400",
        "secondary-fixed": "#d8e3fb",
        "primary": "#d2bbff",
        "error": "#ffb4ab",
        "secondary-container": "#3e495d",
        "surface-container": "#171f33",
        "on-primary-fixed-variant": "#5a00c6",
        "surface-dim": "#0b1326",
        "surface-tint": "#d2bbff",
        "on-tertiary": "#4f2500",
        "on-surface": "#dae2fd",
        "on-error-container": "#ffdad6",
        "on-primary": "#3f008e",
        "primary-fixed": "#eaddff",
        "on-tertiary-container": "#ffe0cd",
        "on-secondary-container": "#aeb9d0",
        "on-primary-fixed": "#25005a",
        "inverse-on-surface": "#283044",
        "tertiary-fixed": "#ffdcc6",
        "surface-container-highest": "#2d3449",
        "primary-container": "#7c3aed",
        "surface-container-low": "#131b2e",
        "on-secondary": "#263143",
        "inverse-primary": "#732ee4",
        "primary-fixed-dim": "#d2bbff",
        "surface": "#0b1326",
        "secondary-fixed-dim": "#bcc7de",
        "on-primary-container": "#ede0ff",
        "tertiary": "#ffb784",
        "tertiary-fixed-dim": "#ffb784",
        "inverse-surface": "#dae2fd",
        "on-background": "#dae2fd"
      },
      borderRadius: {
        "DEFAULT": "0.125rem",
        "lg": "0.25rem",
        "xl": "0.5rem",
        "full": "0.75rem"
      },
      fontFamily: {
        "headline": ["Space Grotesk", "sans-serif"],
        "body": ["Inter", "sans-serif"],
        "label": ["Inter", "sans-serif"],
        "number": ["Outfit", "sans-serif"]
      }
    }
  },
  plugins: [],
}
