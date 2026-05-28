<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useImage } from 'vue-image-kit'
import type { ImageData } from '../assets/images'

const props = defineProps<{ img: ImageData }>()

const containerRef = ref<HTMLElement | null>(null)

const { status, isLoaded, isError, imgAttrs, observe, onImgLoad, onImgError } = useImage({
  src: props.img.src,
  widths: [400, 800, 1200],
  sizes: '(max-width: 768px) 100vw, 800px',
  lazy: false,
})

onMounted(() => observe(containerRef))

const attrsDisplay = computed(() => JSON.stringify(imgAttrs.value, null, 2))
</script>

<template>
  <div style="display: grid; grid-template-columns: 1fr; gap: 24px">
    <!-- Custom render panel -->
    <div class="panel">
      <p class="panel-title">Custom render (no &lt;VImage&gt;)</p>

      <div
        ref="containerRef"
        style="
          position: relative;
          aspect-ratio: 3/2;
          border-radius: 8px;
          overflow: hidden;
          background: #0d1117;
          margin-bottom: 14px;
        "
      >
        <!-- Idle placeholder -->
        <div
          v-if="status === 'idle'"
          style="
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #484f58;
            font-size: 0.82rem;
          "
        >
          idle
        </div>

        <!-- Image -->
        <img
          v-if="status === 'loading' || isLoaded"
          v-bind="imgAttrs"
          :alt="img.name"
          :style="{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: isLoaded ? '1' : '0',
            transition: 'opacity 0.5s ease',
          }"
          @load="onImgLoad"
          @error="onImgError"
        />

        <!-- Error -->
        <div
          v-if="isError"
          style="
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #1a0f0f;
            color: #f85149;
            font-size: 0.82rem;
          "
        >
          error
        </div>
      </div>

      <!-- Custom progress bar -->
      <div
        style="
          height: 3px;
          background: #21262d;
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 14px;
        "
      >
        <div
          style="height: 100%; background: #1f6feb; transition: width 0.4s ease"
          :style="{ width: isLoaded ? '100%' : '0%' }"
        />
      </div>

      <p style="font-size: 0.78rem; color: #8b949e; line-height: 1.6; margin: 0">
        No <code style="color: #e3b341">&lt;VImage&gt;</code> — just
        <code style="color: #e3b341">useImage()</code> + a plain
        <code style="color: #e3b341">&lt;img&gt;</code>. Custom placeholder, custom transition,
        custom progress bar.
      </p>
    </div>

    <!-- State panel -->
    <div class="panel">
      <p class="panel-title">Reactive state</p>

      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px">
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-size: 0.82rem; color: #8b949e">status</span>
          <span class="badge" :class="`badge-${status}`">{{ status }}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-size: 0.82rem; color: #8b949e">isLoaded</span>
          <code style="font-size: 0.82rem" :style="{ color: isLoaded ? '#3fb950' : '#484f58' }">
            {{ isLoaded }}
          </code>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-size: 0.82rem; color: #8b949e">isError</span>
          <code style="font-size: 0.82rem" :style="{ color: isError ? '#f85149' : '#484f58' }">
            {{ isError }}
          </code>
        </div>
      </div>

      <p style="font-size: 0.78rem; color: #8b949e; margin: 0 0 6px">imgAttrs</p>
      <pre class="code-block" style="font-size: 0.72rem">{{ attrsDisplay }}</pre>

      <p style="font-size: 0.78rem; color: #8b949e; margin: 16px 0 6px">Setup</p>
      <pre class="code-block" style="font-size: 0.72rem">
const {
  status,
  isLoaded,
  isError,
  imgAttrs,
  observe,
  onImgLoad,
  onImgError,
} = useImage({
  src: '{{ img.src }}',
  widths: [400, 800, 1200],
  lazy: false,
})</pre
      >
    </div>
  </div>
</template>
