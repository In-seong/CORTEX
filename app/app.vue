<template>
  <div class="min-h-screen bg-brain-bg text-brain-text font-sans antialiased">
    <NuxtPage />
  </div>
</template>

<style>
html {
  background-color: #09090b;
  color-scheme: dark;
}

body {
  overflow-x: hidden;
  background:
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.08), transparent),
    radial-gradient(ellipse 60% 40% at 80% 50%, rgba(34,211,238,0.04), transparent),
    #09090b;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #1a1a2e;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #252540;
}

.page-enter-active,
.page-leave-active {
  transition: all 0.2s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
