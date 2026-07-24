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
        { name: 'theme-color', content: '#262624' },
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
            // Claude 앱 다크 톤 — 따뜻한 그레이 캔버스 + 코랄 액센트
            brain: {
              bg: '#262624',
              surface: '#1e1d1b',
              card: '#30302e',
              border: 'rgba(255,255,255,0.10)',
              'border-light': 'rgba(255,255,255,0.18)',
              muted: '#8f8d85',
              text: '#f5f4ee',
              'text-secondary': '#b7b4aa',
            },
            neon: {
              indigo: '#d97757',       // Claude coral (브랜드 액센트)
              'indigo-deep': '#c25e3f',
              cyan: '#4a9d9c',
              'cyan-deep': '#3d8180',
              emerald: '#7bb87a',
              amber: '#d9a441',
              rose: '#d97066',
              purple: '#b08cc9',
              blue: '#6b9bd1',
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
            'neon': '0 0 0 1px rgba(217,119,87,0.35)',
            'neon-lg': '0 0 0 1px rgba(217,119,87,0.5)',
            'neon-cyan': '0 0 0 1px rgba(74,157,156,0.3)',
            'neon-emerald': '0 0 0 1px rgba(123,184,122,0.3)',
            'neon-rose': '0 0 0 1px rgba(217,112,102,0.3)',
            'floating': '0 10px 24px rgba(0,0,0,0.35)',
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
