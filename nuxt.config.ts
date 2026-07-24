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
        { name: 'theme-color', content: '#f5f4ef' },
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
    script: [
      {
        // FOUC 방지: 페인트 전에 저장된 테마 적용 (기본 라이트)
        innerHTML: `(function(){try{var t=localStorage.getItem('cortex-theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})()`,
        tagPosition: 'head',
      },
    ],
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
            // Claude 앱 톤 — CSS 변수로 라이트(크림)/다크 전환. 값은 main.css :root/.dark
            brain: {
              bg: 'rgb(var(--c-bg) / <alpha-value>)',
              surface: 'rgb(var(--c-surface) / <alpha-value>)',
              card: 'rgb(var(--c-card) / <alpha-value>)',
              border: 'var(--c-border)',
              'border-light': 'var(--c-border-light)',
              muted: 'rgb(var(--c-muted) / <alpha-value>)',
              text: 'rgb(var(--c-text) / <alpha-value>)',
              'text-secondary': 'rgb(var(--c-text-secondary) / <alpha-value>)',
            },
            neon: {
              indigo: 'rgb(var(--c-accent) / <alpha-value>)',       // Claude coral
              'indigo-deep': 'rgb(var(--c-accent-deep) / <alpha-value>)',
              cyan: 'rgb(var(--c-cyan) / <alpha-value>)',
              'cyan-deep': 'rgb(var(--c-cyan) / <alpha-value>)',
              emerald: 'rgb(var(--c-emerald) / <alpha-value>)',
              amber: 'rgb(var(--c-amber) / <alpha-value>)',
              rose: 'rgb(var(--c-rose) / <alpha-value>)',
              purple: 'rgb(var(--c-purple) / <alpha-value>)',
              blue: 'rgb(var(--c-blue) / <alpha-value>)',
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
