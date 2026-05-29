<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { decodeBlurhash, decodeThumbHash, thumbHashToAverageColor } from 'vue-image-kit'
import { images } from '../assets/images'

const selectedIdx = ref(0)
const reloadKey = ref(0)
const img = computed(() => images[selectedIdx.value])

// Remount the live <VImage> previews when the photo changes (useImage captures
// src once) or when replaying the transition.
watch(selectedIdx, () => reloadKey.value++)
function reload() {
  reloadKey.value++
}

// Raw placeholders, rendered statically so they're always visible.
function blurhashToDataUrl(hash: string, w = 64, h = 43): string {
  const pixels = decodeBlurhash(hash, w, h)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.putImageData(new ImageData(pixels, w, h), 0, 0)
  return canvas.toDataURL()
}

const blurhashUrl = computed(() => blurhashToDataUrl(img.value.blurhash))
const thumbhashUrl = computed(() => decodeThumbHash(img.value.thumbhash))
const avgColor = computed(() => thumbHashToAverageColor(img.value.thumbhash))

const modes = computed(() => [
  {
    id: 'blur',
    label: 'BlurHash',
    note: 'canvas-decoded — ~25 chars, no alpha',
    kind: 'image' as const,
    raw: blurhashUrl.value,
  },
  {
    id: 'thumbhash',
    label: 'ThumbHash',
    note: 'decoded to a blurred PNG — alpha support',
    kind: 'image' as const,
    raw: thumbhashUrl.value,
  },
  {
    id: 'color',
    label: 'placeholderMode="color"',
    note: 'average RGBA from the ThumbHash header — 0 bytes, no canvas',
    kind: 'color' as const,
    raw: avgColor.value,
  },
  {
    id: 'shimmer',
    label: 'placeholderMode="shimmer"',
    note: 'animated CSS skeleton — needs no hash at all',
    kind: 'shimmer' as const,
    raw: '',
  },
])
</script>

<template>
  <div>
    <p class="tab-title">Placeholder modes — color &amp; shimmer</p>
    <p class="tab-desc">
      Beyond blur-up, VImage offers two ultra-cheap placeholders:
      <code style="color: #e3b341">placeholderMode="color"</code> (a solid average color pulled
      straight from the ThumbHash header — no canvas, 0 bytes) and
      <code style="color: #e3b341">placeholderMode="shimmer"</code> (an animated skeleton needing no
      hash at all). Each card shows the <strong>raw placeholder</strong> on the left and the
      <strong>live load</strong> (placeholder → image) on the right.
    </p>

    <div class="control-row" style="margin-bottom: 20px">
      <span class="control-label">Photo</span>
      <select class="control-select" v-model="selectedIdx">
        <option v-for="(im, i) in images" :key="im.name" :value="i">{{ im.name }}</option>
      </select>
      <span style="margin-left: 12px; display: inline-flex; align-items: center; gap: 8px">
        <span class="swatch" :style="{ background: avgColor }" />
        <code style="color: #79c0ff; font-size: 0.78rem">{{ avgColor }}</code>
      </span>
      <button class="btn btn-primary" style="margin-left: auto" @click="reload">↺ Replay</button>
    </div>

    <div class="ph-grid">
      <div v-for="mode in modes" :key="mode.id" class="panel">
        <p class="panel-title">{{ mode.label }}</p>

        <div class="ph-pair">
          <div class="ph-cell">
            <div class="ph-cell-label">Placeholder</div>
            <div class="ph-frame">
              <img v-if="mode.kind === 'image'" :src="mode.raw" alt="" class="ph-raw-img" />
              <div v-else-if="mode.kind === 'color'" class="ph-raw-fill" :style="{ background: mode.raw }" />
              <div v-else class="ph-raw-fill ph-shimmer" />
            </div>
          </div>

          <div class="ph-cell">
            <div class="ph-cell-label">Live load</div>
            <div class="ph-frame">
              <VImage
                :key="`${mode.id}-${selectedIdx}-${reloadKey}`"
                :src="img.src"
                :alt="img.name"
                :width="img.width"
                :height="img.height"
                :blurhash="mode.id === 'blur' ? img.blurhash : undefined"
                :thumbhash="mode.id === 'thumbhash' || mode.id === 'color' ? img.thumbhash : undefined"
                :placeholder-mode="mode.id === 'color' ? 'color' : mode.id === 'shimmer' ? 'shimmer' : 'blur'"
                :lazy="false"
                style="width: 100%; height: 100%"
              />
            </div>
          </div>
        </div>

        <p class="ph-note">{{ mode.note }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ph-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}
@media (max-width: 860px) {
  .ph-grid {
    grid-template-columns: 1fr;
  }
}
.ph-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.ph-cell-label {
  font-size: 0.72rem;
  color: #8b949e;
  margin-bottom: 6px;
}
.ph-frame {
  aspect-ratio: 3/2;
  border-radius: 8px;
  overflow: hidden;
  background: #0d1117;
}
.ph-raw-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
}
.ph-raw-fill {
  width: 100%;
  height: 100%;
}
.ph-note {
  color: #8b949e;
  font-size: 0.76rem;
  margin-top: 12px;
}
.swatch {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid #30363d;
  display: inline-block;
}

/* Matches VImage's built-in shimmer */
.ph-shimmer {
  background: #e2e5ea linear-gradient(90deg, rgba(255, 255, 255, 0) 20%, rgba(255, 255, 255, 0.85) 50%, rgba(255, 255, 255, 0) 80%);
  background-repeat: no-repeat;
  background-size: 200% 100%;
  animation: ph-shimmer 1.3s ease-in-out infinite;
}
@keyframes ph-shimmer {
  0% {
    background-position: 180% 0;
  }
  100% {
    background-position: -80% 0;
  }
}
</style>
