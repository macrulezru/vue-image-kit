<script setup lang="ts">
import { ref } from 'vue'
import {
  encodeThumbHash,
  encodeBlurhash,
  decodeThumbHash,
  thumbHashToAverageColor,
} from 'vue-image-kit'

const originalUrl = ref<string>('')
const thumbhash = ref<string>('')
const blurhash = ref<string>('')
const thumbPreview = ref<string>('')
const avgColor = ref<string>('')
const busy = ref(false)
const error = ref<string>('')
const fileName = ref<string>('')

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  error.value = ''
  busy.value = true
  fileName.value = `${file.name} (${(file.size / 1024).toFixed(0)} KB)`

  if (originalUrl.value) URL.revokeObjectURL(originalUrl.value)
  originalUrl.value = URL.createObjectURL(file)

  try {
    thumbhash.value = await encodeThumbHash(file)
    blurhash.value = await encodeBlurhash(file, { componentX: 4, componentY: 3 })
    thumbPreview.value = decodeThumbHash(thumbhash.value)
    avgColor.value = thumbHashToAverageColor(thumbhash.value)
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <p class="tab-title">Encode on the client — for user uploads</p>
    <p class="tab-desc">
      When a user uploads a photo, encode a placeholder <strong>in the browser</strong> so you can
      show a blur-up preview instantly. <code style="color: #e3b341">encodeThumbHash()</code> and
      <code style="color: #e3b341">encodeBlurhash()</code> accept a <code style="color: #e3b341">File</code>,
      <code style="color: #e3b341">Canvas</code>, or <code style="color: #e3b341">ImageData</code> — no upload, no server, no dependencies.
    </p>

    <div class="panel" style="margin-bottom: 20px">
      <label class="upload">
        <input type="file" accept="image/*" @change="onFile" />
        <span class="upload-btn">📤 Choose an image…</span>
        <span v-if="fileName" class="upload-name">{{ fileName }}</span>
      </label>
      <p v-if="busy" style="color: #388bfd; font-size: 0.8rem; margin-top: 10px">Encoding…</p>
      <p v-if="error" style="color: #f85149; font-size: 0.8rem; margin-top: 10px">{{ error }}</p>
    </div>

    <div v-if="originalUrl" class="demo-grid">
      <div class="panel">
        <p class="panel-title">Original</p>
        <div class="enc-frame"><img :src="originalUrl" alt="original" /></div>
      </div>

      <div class="panel">
        <p class="panel-title">Decoded ThumbHash preview</p>
        <div class="enc-frame">
          <img v-if="thumbPreview" :src="thumbPreview" alt="thumbhash preview" />
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 12px">
          <span class="swatch" :style="{ background: avgColor }" />
          <code style="color: #79c0ff; font-size: 0.76rem">{{ avgColor }}</code>
        </div>
      </div>
    </div>

    <div v-if="thumbhash" class="panel" style="margin-top: 20px">
      <p class="panel-title">Encoded hashes</p>
      <p class="hash-label">ThumbHash (base64)</p>
      <div class="code-block hash-out">{{ thumbhash }}</div>
      <p class="hash-label" style="margin-top: 12px">BlurHash</p>
      <div class="code-block hash-out">{{ blurhash }}</div>

      <div class="code-block" style="margin-top: 16px">{{
`import { encodeThumbHash } from 'vue-image-kit'

const hash = await encodeThumbHash(file)
// → feed into <VImage :thumbhash="hash"> or decodeThumbHash(hash)`
      }}</div>
    </div>
  </div>
</template>

<style scoped>
.upload {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
}
.upload input {
  display: none;
}
.upload-btn {
  background: #1f6feb;
  border-radius: 6px;
  color: #fff;
  font-size: 0.85rem;
  padding: 8px 16px;
  transition: background 0.15s;
}
.upload:hover .upload-btn {
  background: #388bfd;
}
.upload-name {
  color: #8b949e;
  font-size: 0.8rem;
}
.enc-frame {
  aspect-ratio: 3/2;
  border-radius: 8px;
  overflow: hidden;
  background: #0d1117;
  display: flex;
  align-items: center;
  justify-content: center;
}
.enc-frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.hash-label {
  color: #8b949e;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}
.hash-out {
  color: #e3b341;
  word-break: break-all;
}
.swatch {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid #30363d;
  display: inline-block;
}
</style>
