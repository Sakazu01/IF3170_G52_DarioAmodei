/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["system-ui", "sans-serif"],
        mono: ["ui-monospace", "monospace"],
      },
      // semua warna memakai CSS variable (index.css) supaya tema terang/gelap cukup ganti token
      colors: {
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        line: "var(--line)",
        ink: "var(--text)",
        sub: "var(--text-2)",
        acc: "var(--acc)",
        accd: "var(--accd)",
        tint: "var(--tint)",
        err: "var(--err)",
      },
    },
  },
  plugins: [],
};
