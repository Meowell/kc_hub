/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        "bg-base": "hsl(var(--color-bg-base))",
        "bg-panel": "hsl(var(--color-bg-panel))",
        "bg-panel-subtle": "hsl(var(--color-bg-panel-subtle))",
        "border-base": "hsl(var(--color-border-base))",
        "border-strong": "hsl(var(--color-border-strong))",
        "text-main": "hsl(var(--color-text-main))",
        "text-muted": "hsl(var(--color-text-muted))",
        primary: "hsl(var(--color-primary))",
        success: "hsl(var(--color-success))",
        warning: "hsl(var(--color-warning))",
        danger: "hsl(var(--color-danger))",
      },
    },
  },
  plugins: [],
};
