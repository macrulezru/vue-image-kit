<script setup lang="ts">
import { ref, defineAsyncComponent } from 'vue'

const tabs = [
  { id: 'basic', label: 'Basic', icon: '🖼' },
  { id: 'blurhash', label: 'Blurhash & LQIP', icon: '🎨' },
  { id: 'formats', label: 'AVIF / WebP', icon: '⚡' },
  { id: 'srcset', label: 'srcset', icon: '📐' },
  { id: 'responsive', label: 'Responsive sources', icon: '📱' },
  { id: 'lazyload', label: 'Lazy Load', icon: '👁' },
  { id: 'directive', label: 'v-lazy-img', icon: '🪄' },
  { id: 'error', label: 'Error State', icon: '❌' },
  { id: 'headless', label: 'Headless', icon: '🔧' },
  { id: 'cdn', label: 'CDN adapters', icon: '🌐' },
]

const active = ref('basic')

const TabBasic = defineAsyncComponent(() => import('./tabs/TabBasic.vue'))
const TabBlurhash = defineAsyncComponent(() => import('./tabs/TabBlurhash.vue'))
const TabFormats = defineAsyncComponent(() => import('./tabs/TabFormats.vue'))
const TabSrcset = defineAsyncComponent(() => import('./tabs/TabSrcset.vue'))
const TabResponsive = defineAsyncComponent(() => import('./tabs/TabResponsive.vue'))
const TabLazyLoad = defineAsyncComponent(() => import('./tabs/TabLazyLoad.vue'))
const TabDirective = defineAsyncComponent(() => import('./tabs/TabDirective.vue'))
const TabError = defineAsyncComponent(() => import('./tabs/TabError.vue'))
const TabHeadless = defineAsyncComponent(() => import('./tabs/TabHeadless.vue'))
const TabCdn = defineAsyncComponent(() => import('./tabs/TabCdn.vue'))

const components: Record<string, ReturnType<typeof defineAsyncComponent>> = {
  basic: TabBasic,
  blurhash: TabBlurhash,
  formats: TabFormats,
  srcset: TabSrcset,
  responsive: TabResponsive,
  lazyload: TabLazyLoad,
  directive: TabDirective,
  error: TabError,
  headless: TabHeadless,
  cdn: TabCdn,
}
</script>

<template>
  <div class="shell">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-logo">
        <span class="logo-icon">🖼</span>
        <div>
          <div class="logo-name">vue-image-kit</div>
        </div>
      </div>

      <nav class="sidebar-nav">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="nav-item"
          :class="{ active: active === tab.id }"
          @click="active = tab.id"
        >
          <span class="nav-icon">{{ tab.icon }}</span>
          <span class="nav-label">{{ tab.label }}</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <a class="gh-link" href="https://github.com/macrulezru/vue-image-kit" target="_blank">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.031 1.531 1.031.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"
            />
          </svg>
          GitHub
        </a>
      </div>
    </aside>

    <!-- Main content -->
    <div class="main">
      <div class="content">
        <Suspense>
          <component :is="components[active]" />
        </Suspense>
      </div>
    </div>
  </div>
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
}

.shell {
  display: flex;
  height: 100dvh; /* fixed height → .main clips and scrolls internally */
  overflow: hidden; /* prevent body scroll — .main handles scroll */
  background: #0f1117;
}

/* ─── Sidebar ─── */
.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #161b22;
  border-right: 1px solid #30363d;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100dvh;
  overflow-y: auto;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 16px 16px;
  border-bottom: 1px solid #30363d;
}
.logo-icon {
  font-size: 1.5rem;
  line-height: 1;
}
.logo-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: #f0f6fc;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.sidebar-nav {
  flex: 1;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  border-radius: 6px;
  color: #8b949e;
  cursor: pointer;
  font-size: 0.85rem;
  line-height: 1;
  padding: 8px 10px;
  text-align: left;
  transition:
    background 0.15s,
    color 0.15s;
  width: 100%;
}
.nav-item:hover {
  background: #21262d;
  color: #c9d1d9;
}
.nav-item.active {
  background: #1f3049;
  color: #f0f6fc;
  font-weight: 500;
}
.nav-item.active .nav-icon {
  opacity: 1;
}
.nav-icon {
  font-size: 1rem;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
  opacity: 0.8;
}

.sidebar-footer {
  padding: 12px 16px 16px;
  border-top: 1px solid #30363d;
}
.gh-link {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.8rem;
  color: #8b949e;
  text-decoration: none;
  transition: color 0.15s;
}
.gh-link:hover {
  color: #f0f6fc;
}

/* ─── Main ─── */
.main {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
}
.content {
  max-width: 1100px;
  padding: 36px 32px;
}

/* ─── Responsive: collapse sidebar on narrow screens ─── */
@media (max-width: 720px) {
  .shell {
    flex-direction: column;
  }
  .sidebar {
    width: 100%;
    height: auto;
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
    border-right: none;
    border-bottom: 1px solid #30363d;
  }
  .sidebar-logo {
    border-bottom: none;
    padding: 12px 16px;
  }
  .sidebar-nav {
    flex-direction: row;
    flex-wrap: wrap;
    padding: 6px 8px;
    gap: 2px;
    width: 100%;
    border-top: 1px solid #30363d;
  }
  .nav-item {
    width: auto;
    font-size: 0.78rem;
    padding: 6px 8px;
  }
  .nav-label {
    display: none;
  }
  .sidebar-footer {
    display: none;
  }
  .content {
    padding: 20px 16px;
  }
}

/* ─── Shared demo helpers (used across all tabs) ─── */
.tab-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: #f0f6fc;
  margin-bottom: 6px;
}
.tab-desc {
  font-size: 0.875rem;
  color: #8b949e;
  margin-bottom: 28px;
  line-height: 1.6;
}
.demo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.demo-grid > * {
  min-width: 0;
}
@media (max-width: 860px) {
  .demo-grid {
    grid-template-columns: 1fr;
  }
}
.panel {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 10px;
  padding: 20px;
}
.panel-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #8b949e;
  margin-bottom: 16px;
}
.badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.badge-idle {
  background: #21262d;
  color: #8b949e;
}
.badge-loading {
  background: #1c2a3c;
  color: #388bfd;
}
.badge-loaded {
  background: #1a2d1a;
  color: #3fb950;
}
.badge-error {
  background: #2d1a1a;
  color: #f85149;
}

.code-block {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 12px 14px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 0.78rem;
  color: #e6edf3;
  overflow-x: auto;
  line-height: 1.6;
}
.control-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.control-label {
  font-size: 0.8rem;
  color: #8b949e;
  min-width: 90px;
}
.control-select,
.control-input {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #e6edf3;
  font-size: 0.82rem;
  padding: 5px 10px;
  outline: none;
}
.control-select:focus,
.control-input:focus {
  border-color: #388bfd;
}
.toggle {
  position: relative;
  width: 36px;
  height: 20px;
  cursor: pointer;
}
.toggle input {
  display: none;
}
.toggle-track {
  position: absolute;
  inset: 0;
  background: #21262d;
  border-radius: 20px;
  transition: background 0.2s;
}
.toggle input:checked + .toggle-track {
  background: #1f6feb;
}
.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 50%;
  transition: left 0.2s;
}
.toggle input:checked ~ .toggle-thumb {
  left: 19px;
}
.btn {
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #e6edf3;
  cursor: pointer;
  font-size: 0.82rem;
  padding: 6px 14px;
  transition:
    background 0.15s,
    border-color 0.15s;
}
.btn:hover {
  background: #30363d;
  border-color: #8b949e;
}
.btn-primary {
  background: #1f6feb;
  border-color: #1f6feb;
  color: #fff;
}
.btn-primary:hover {
  background: #388bfd;
  border-color: #388bfd;
}
</style>
