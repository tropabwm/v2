// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './entities/**/*.{ts,tsx}',
    './styles/**/*.{ts,tsx}',
    './context/**/*.{ts,tsx}', // Adicionei esta linha para garantir que o contexto seja escaneado
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
          // Core Shadcn/UI colors using HSL variables
          border: "hsl(var(--border))",
          input: "hsl(var(--input))", // Standard input border/bg
          ring: "hsl(var(--ring))",
          background: "hsl(var(--background))", // Main background
          foreground: "hsl(var(--foreground))", // Main text color
          primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
          // Secondary is often used for interactive elements, adjust for neumorphism if needed
          secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
          destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
          muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
          accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
          popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
          card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },

          // Custom colors for Neumorphism/Dark Theme consistency
          // Assuming these HSL variables are defined in your globals.css for dark mode
          'element-bg': "hsl(var(--element-bg))", // Base background for neumorphic elements (slightly different from main background)
          'element-bg-raised': "hsl(var(--element-bg-raised))", // Background for elements that appear 'outset'
          'element-bg-inset': "hsl(var(--element-bg-inset))", // Background for elements that appear 'inset'
          'element-foreground': "hsl(var(--element-foreground))", // Text color for neumorphic elements
          'element-border': "hsl(var(--element-border))", // Border color for neumorphic elements (can be subtle)

          // Sidebar specific colors (if different from general elements)
          sidebar: {
              background: "hsl(var(--sidebar-background))",
              foreground: "hsl(var(--sidebar-foreground))",
              border: "hsl(var(--sidebar-border))",
              accent: "hsl(var(--sidebar-accent))",
              'accent-foreground': "hsl(var(--sidebar-accent-foreground))",
          },

          // Chart colors (keep existing)
          chart: {
              '1': "hsl(var(--chart-1))",
              '2': "hsl(var(--chart-2))",
              '3': "hsl(var(--chart-3))",
              '4': "hsl(var(--chart-4))",
              '5': "hsl(var(--chart-5))",
          },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
         "caret-blink": { "0%,70%,100%": { opacity: "1" }, "20%,50%": { opacity: "0" } }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
         "caret-blink": "caret-blink 1.25s ease-out infinite"
      },
      // Custom box shadows for dark neumorphism using CSS variables
      boxShadow: {
        'neumorphic-outset': 'var(--neumorphic-shadow-outset)',
        'neumorphic-inset': 'var(--neumorphic-shadow-inset)',
        // 'neumorphic-pressed': 'var(--neumorphic-shadow-pressed)', // Use inset shadow for pressed state
       },
       textShadow: { // Optional: text-shadow utility if needed
          'neumorphic': 'var(--neumorphic-text-shadow)',
       }
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require('@tailwindcss/typography') // <<< ADICIONADO AQUI
  ],
};
