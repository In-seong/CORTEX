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
        { name: 'mobile-web-app-capable', content: 'yes' },
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
              bg: '#0a0a0a',
              surface: '#111113',
              card: '#171717',
              border: 'rgba(255,255,255,0.07)',
              'border-light': 'rgba(255,255,255,0.14)',
              muted: '#737373',
              text: '#fafafa',
              'text-secondary': '#a1a1a1',
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
            'slide-up': 'slide-up 0.25s ease-out',
            'fade-in': 'fade-in 0.2s ease-out',
          },
          keyframes: {
            'slide-up': {
              '0%': { transform: 'translateY(12px)', opacity: '0' },
              '100%': { transform: 'translateY(0)', opacity: '1' },
            },
            'fade-in': {
              '0%': { opacity: '0' },
              '100%': { opacity: '1' },
            },
          },
          boxShadow: {
            'neon': '0 0 0 1px rgba(129,140,248,0.3)',
            'neon-lg': '0 0 0 1px rgba(129,140,248,0.45)',
            'neon-cyan': '0 0 0 1px rgba(34,211,238,0.3)',
            'neon-emerald': '0 0 0 1px rgba(52,211,153,0.3)',
            'neon-rose': '0 0 0 1px rgba(251,113,133,0.3)',
            'floating': '0 10px 24px rgba(0,0,0,0.4)',
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
