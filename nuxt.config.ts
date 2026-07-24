export default defineNuxtConfig({
  compatibilityDate: '2025-06-18',
  ssr: false,
  devtools: { enabled: true },
  srcDir: 'app/',
  css: ['~/assets/css/main.css'],

  modules: [
    '@nuxtjs/tailwindcss',
    '@vueuse/motion/nuxt',
  ],

  app: {
    head: {
      title: 'CORTEX',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#818cf8' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.json' },
        { rel: 'apple-touch-icon', href: '/icon-192.png' },
        { rel: 'preconnect', href: 'https://cdn.jsdelivr.net' },
        {
          rel: 'stylesheet',
          href: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap',
        },
      ],
    },
    pageTransition: { name: 'page', mode: 'out-in' },
  },

  tailwindcss: {
    config: {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Pretendard Variable', 'Pretendard', 'system-ui', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          },
          colors: {
            brain: {
              bg: '#08080f',
              surface: '#0e0e1a',
              card: '#141425',
              border: '#1e1e3a',
              'border-light': '#2a2a50',
              muted: '#6a6a88',
              text: '#e8e8f5',
              'text-secondary': '#9a9ab8',
            },
            neon: {
              indigo: '#818cf8',
              'indigo-deep': '#6366f1',
              cyan: '#22d3ee',
              'cyan-deep': '#06b6d4',
              emerald: '#34d399',
              amber: '#fbbf24',
              rose: '#fb7185',
              purple: '#a78bfa',
              blue: '#60a5fa',
            },
          },
          animation: {
            'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
            'float': 'float 6s ease-in-out infinite',
            'slide-up': 'slide-up 0.5s ease-out',
            'fade-in': 'fade-in 0.3s ease-out',
            'particle-flow': 'particle-flow 3s linear infinite',
          },
          keyframes: {
            'glow-pulse': {
              '0%, 100%': { opacity: '0.4' },
              '50%': { opacity: '1' },
            },
            'float': {
              '0%, 100%': { transform: 'translateY(0px)' },
              '50%': { transform: 'translateY(-10px)' },
            },
            'slide-up': {
              '0%': { transform: 'translateY(20px)', opacity: '0' },
              '100%': { transform: 'translateY(0)', opacity: '1' },
            },
            'fade-in': {
              '0%': { opacity: '0' },
              '100%': { opacity: '1' },
            },
            'particle-flow': {
              '0%': { strokeDashoffset: '20' },
              '100%': { strokeDashoffset: '0' },
            },
          },
          boxShadow: {
            'neon': '0 0 20px rgba(99,102,241,0.3)',
            'neon-lg': '0 0 40px rgba(99,102,241,0.4)',
            'neon-cyan': '0 0 20px rgba(34,211,238,0.3)',
            'neon-emerald': '0 0 20px rgba(52,211,153,0.3)',
            'neon-rose': '0 0 20px rgba(251,113,133,0.3)',
            'glow': '0 0 60px rgba(99,102,241,0.15)',
          },
          backgroundImage: {
            'grid-pattern': 'linear-gradient(rgba(26,26,46,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(26,26,46,0.5) 1px, transparent 1px)',
            'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
          },
        },
      },
    },
  },

  vite: {
    server: {
      allowedHosts: ['cortex.revuplan.com'],
    },
  },

  nitro: {
    experimental: {
      websocket: true,
    },
    externals: {
      inline: [],
    },
    rollupConfig: {
      external: ['node-pty'],
    },
  },

  typescript: {
    strict: true,
  },
})
