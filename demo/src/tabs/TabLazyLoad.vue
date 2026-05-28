<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImagePreloader } from 'vue-image-kit'
import { images } from '../assets/images'

const rootMargin = ref(0)
const reloadKey = ref(0)
const statuses = ref<Record<string, 'idle' | 'loaded' | 'error'>>({})

// 16 items — 2 full rows visible, rest below the fold
const items = Array.from({ length: 64 }, (_, i) => ({
  key: `item-${i}`,
  img: images[i % images.length],
  index: i + 1,
}))

function getStatus(key: string): 'idle' | 'loaded' | 'error' {
  return statuses.value[key] ?? 'idle'
}

function onLoad(key: string) {
  statuses.value[key] = 'loaded'
}
function onError(key: string) {
  statuses.value[key] = 'error'
}

function reload() {
  statuses.value = {}
  reloadKey.value++
  // Scroll back to top of content
  document.querySelector('.main')?.scrollTo({ top: 0, behavior: 'smooth' })
}

const idleCount = computed(() => items.filter((i) => getStatus(i.key) === 'idle').length)
const loadedCount = computed(() => items.filter((i) => getStatus(i.key) === 'loaded').length)

// ── useImagePreloader gallery demo ──────────────────────────────────────────
const { preload, progress, isComplete } = useImagePreloader()

const galleryImages = images.slice(0, 6)
const galleryIdx = ref(0)
const isPreloading = ref(false)

// Накопительный счётчик уникальных preloaded URL (не сбрасывается между вызовами)
const cachedUrls = ref(new Set<string>())
const totalCached = computed(() => cachedUrls.value.size)

const galleryImg = computed(() => galleryImages[galleryIdx.value])

async function runPreload(urls: string[]) {
  isPreloading.value = true
  await preload(urls)
  urls.forEach((u) => cachedUrls.value.add(u))
  isPreloading.value = false
}

async function goNext() {
  const nextIdx = (galleryIdx.value + 1) % galleryImages.length
  const afterIdx = (nextIdx + 1) % galleryImages.length
  await runPreload([galleryImages[nextIdx].src, galleryImages[afterIdx].src])
  galleryIdx.value = nextIdx
}

async function goPrev() {
  const prevIdx = (galleryIdx.value - 1 + galleryImages.length) % galleryImages.length
  await runPreload([galleryImages[prevIdx].src])
  galleryIdx.value = prevIdx
}

async function preloadAll() {
  await runPreload(galleryImages.map((i) => i.src))
}
</script>

<template>
  <div>
    <p class="tab-title">Lazy loading via IntersectionObserver</p>
    <p class="tab-desc">
      Each image loads only when it enters the viewport. Images above the fold start loading
      immediately — images below stay
      <strong style="color: #8b949e">idle</strong> (grey) until you scroll to them. Watch the
      blurhash placeholder appear first, then fade into the real photo.
    </p>

    <!-- Controls -->
    <div class="panel" style="margin-bottom: 24px">
      <div style="display: flex; align-items: center; gap: 24px; flex-wrap: wrap">
        <div style="display: flex; align-items: center; gap: 10px">
          <span class="control-label">rootMargin</span>
          <input
            type="range"
            min="0"
            max="400"
            step="50"
            v-model.number="rootMargin"
            style="width: 110px; accent-color: #1f6feb"
            @change="reload"
          />
          <code style="font-size: 0.82rem; color: #e6edf3; min-width: 40px"
            >{{ rootMargin }}px</code
          >
          <span style="font-size: 0.75rem; color: #484f58">
            {{
              rootMargin === 0
                ? '— load exactly on entry'
                : `— start loading ${rootMargin}px before entry`
            }}
          </span>
        </div>

        <div style="display: flex; align-items: center; gap: 16px; margin-left: auto">
          <div style="display: flex; align-items: center; gap: 6px">
            <span class="badge badge-idle">idle</span>
            <span style="font-size: 0.85rem; font-weight: 600; color: #8b949e">{{
              idleCount
            }}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px">
            <span class="badge badge-loaded">loaded</span>
            <span style="font-size: 0.85rem; font-weight: 600; color: #3fb950">{{
              loadedCount
            }}</span>
          </div>
          <button class="btn btn-primary" @click="reload">↺ Reset</button>
        </div>
      </div>
    </div>

    <!-- useImagePreloader demo -->
    <div class="panel" style="margin-bottom:24px">
      <p class="panel-title">useImagePreloader — preload before navigation</p>
      <div class="preloader-layout">
        <!-- Gallery -->
        <div>
          <div style="aspect-ratio:3/2;border-radius:8px;overflow:hidden;background:#0d1117;margin-bottom:12px;position:relative">
            <img
              :src="galleryImg.src"
              :alt="galleryImg.name"
              style="width:100%;height:100%;object-fit:cover;display:block"
            />
            <div v-if="isPreloading" class="preload-overlay">
              <div class="preload-bar-wrap">
                <div class="preload-bar" :style="{ width: progress + '%' }" />
              </div>
              <span style="font-size:0.75rem;color:#e6edf3;margin-top:6px">
                Preloading… {{ progress }}%
              </span>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn" @click="goPrev" :disabled="isPreloading">← Prev</button>
            <span style="flex:1;text-align:center;font-size:0.78rem;color:#484f58">
              {{ galleryIdx + 1 }} / {{ galleryImages.length }}
            </span>
            <button class="btn" @click="goNext" :disabled="isPreloading">Next →</button>
          </div>
          <div style="margin-top:10px;text-align:center">
            <button class="btn btn-primary" @click="preloadAll" :disabled="isPreloading || isComplete">
              {{ isComplete ? '✓ All preloaded' : 'Preload all 6 images' }}
            </button>
          </div>
        </div>

        <!-- Explanation -->
        <div style="display:flex;flex-direction:column;gap:14px">
          <div style="font-size:0.82rem;color:#8b949e;line-height:1.7">
            Clicking <strong style="color:#e6edf3">Next / Prev</strong> preloads
            the target image first — transition happens only when it's cached.
            No flash of loading state.
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.78rem">
            <div style="background:#0d1117;border-radius:6px;padding:10px">
              <div style="color:#484f58;margin-bottom:4px">Cached total</div>
              <div style="font-size:1.4rem;font-weight:700;color:#3fb950">{{ totalCached }} / {{ galleryImages.length }}</div>
            </div>
            <div style="background:#0d1117;border-radius:6px;padding:10px">
              <div style="color:#484f58;margin-bottom:4px">Batch progress</div>
              <div style="font-size:1.4rem;font-weight:700;color:#388bfd">{{ progress }}%</div>
            </div>
          </div>

          <pre class="code-block" style="font-size:0.7rem">const { preload, progress,
        loaded, isComplete } = useImagePreloader()

// Before navigating to next slide:
await preload([nextSlide.src])
// Image is now cached — instant transition</pre>
        </div>
      </div>
    </div>

    <!-- Hint -->
    <div
      style="
        text-align: center;
        padding: 8px 0 20px;
        font-size: 0.82rem;
        color: #484f58;
        letter-spacing: 0.02em;
      "
    >
      ↓ &nbsp; Scroll down to trigger lazy loading &nbsp; ↓
    </div>

    <!-- Image grid -->
    <div class="lazy-grid">
      <div v-for="item in items" :key="item.key" class="lazy-cell">
        <!-- Status overlay -->
        <div class="lazy-status" :class="`lazy-status--${getStatus(item.key)}`">
          <span class="badge" :class="`badge-${getStatus(item.key)}`">
            {{ getStatus(item.key) }}
          </span>
        </div>

        <VImage
          :key="`${reloadKey}-${item.key}`"
          :src="item.img.src"
          :alt="item.img.name"
          :width="item.img.width"
          :height="item.img.height"
          :blurhash="item.img.blurhash"
          :lazy="true"
          :root-margin="`${rootMargin}px`"
          :threshold="0"
          fit="cover"
          style="width: 100%; height: 100%; display: block"
          @load="onLoad(item.key)"
          @error="onError(item.key)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.lazy-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

@media (max-width: 860px) {
  .lazy-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.lazy-cell {
  position: relative;
  aspect-ratio: 3 / 2;
  border-radius: 8px;
  overflow: hidden;
  background: #161b22;
}

/* Status badge overlay — top-left corner */
.lazy-status {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  pointer-events: none;
  transition: opacity 0.4s ease;
}
.lazy-status--loaded {
  opacity: 0;
}

.preloader-layout {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 24px;
  align-items: start;
}

@media (max-width: 760px) {
  .preloader-layout {
    grid-template-columns: 1fr;
  }
}

.preload-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.preload-bar-wrap {
  width: 60%;
  height: 4px;
  background: #30363d;
  border-radius: 4px;
  overflow: hidden;
}

.preload-bar {
  height: 100%;
  background: #1f6feb;
  border-radius: 4px;
  transition: width 0.2s ease;
}
</style>
