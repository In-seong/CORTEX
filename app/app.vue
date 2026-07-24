<template>
  <div class="min-h-screen bg-brain-bg text-brain-text font-sans antialiased">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<style>
html {
  background-color: rgb(var(--c-bg));
  color-scheme: light;
}
html.dark {
  color-scheme: dark;
}

body {
  overflow-x: hidden;
  background: rgb(var(--c-bg));
  letter-spacing: 0.01em;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--c-border-light);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgb(var(--c-muted) / 0.6);
}

.page-enter-active,
.page-leave-active {
  transition: opacity 0.15s ease;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
}
</style>
