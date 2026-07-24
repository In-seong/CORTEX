// 라이트(크림)/다크 테마 토글 — html.dark 클래스 + localStorage.
// xterm 등 JS로 색을 지정하는 컴포넌트가 반응하도록 전역 ref로 노출.
const isDark = ref(false)

export function useTheme() {
  function apply(dark: boolean) {
    isDark.value = dark
    if (import.meta.client) {
      document.documentElement.classList.toggle('dark', dark)
      localStorage.setItem('cortex-theme', dark ? 'dark' : 'light')
    }
  }

  function toggle() {
    apply(!isDark.value)
  }

  function init() {
    if (import.meta.client) {
      isDark.value = document.documentElement.classList.contains('dark')
    }
  }

  return { isDark, toggle, apply, init }
}
