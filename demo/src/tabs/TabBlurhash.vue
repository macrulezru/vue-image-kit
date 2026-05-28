<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { decodeBlurhash, decodeThumbHash } from 'vue-image-kit'
import { images } from '../assets/images'

const selectedIdx = ref(0)
const img = ref(images[0])
const customHash = ref(images[0].blurhash)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const hashError = ref('')
const reloadKey = ref(0)

watch(selectedIdx, (i) => {
  img.value = images[i]
  customHash.value = images[i].blurhash
  hashError.value = ''
  renderCanvas(images[i].blurhash)
  reloadKey.value++
})

function renderCanvas(hash: string) {
  hashError.value = ''
  const canvas = canvasRef.value
  if (!canvas) return
  try {
    const pixels = decodeBlurhash(hash, 128, 85)
    canvas.width = 128
    canvas.height = 85
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(new ImageData(pixels, 128, 85), 0, 0)
  } catch (e) {
    hashError.value = String(e)
  }
}

watch(customHash, (h) => {
  try {
    renderCanvas(h)
  } catch {}
})
onMounted(() => renderCanvas(customHash.value))
function reload() {
  reloadKey.value++
}

const thumbDataUrl = computed(() => decodeThumbHash(img.value.thumbhash))
</script>

<template>
  <div>
    <p class="tab-title">Blurhash & LQIP placeholders</p>
    <p class="tab-desc">
      Blurhash is decoded entirely in-browser without external packages. Compare the canvas
      placeholder with the LQIP blur-up technique side by side.
    </p>

    <!-- Photo selector -->
    <div class="control-row" style="margin-bottom: 24px">
      <span class="control-label">Photo</span>
      <select class="control-select" v-model="selectedIdx">
        <option v-for="(im, i) in images" :key="im.name" :value="i">{{ im.name }}</option>
      </select>
      <button class="btn btn-primary" @click="reload">↺ Replay transition</button>
    </div>

    <div class="demo-grid" style="margin-bottom: 24px">
      <!-- Blurhash panel -->
      <div class="panel">
        <p class="panel-title">Blurhash canvas</p>

        <div style="margin-bottom: 14px">
          <div style="font-size: 0.78rem; color: #8b949e; margin-bottom: 6px">Blurhash string</div>
          <input
            class="control-input"
            style="width: 100%; font-size: 0.75rem"
            v-model="customHash"
          />
          <div v-if="hashError" style="color: #f85149; font-size: 0.72rem; margin-top: 4px">
            {{ hashError }}
          </div>
        </div>

        <div style="font-size: 0.78rem; color: #8b949e; margin-bottom: 8px">
          Decoded canvas (128×85)
        </div>
        <canvas
          ref="canvasRef"
          style="width: 100%; border-radius: 6px; image-rendering: pixelated"
        />

        <div style="margin-top: 16px">
          <div style="font-size: 0.78rem; color: #8b949e; margin-bottom: 8px">
            Live preview with fade
          </div>
          <div style="aspect-ratio: 3/2; border-radius: 8px; overflow: hidden">
            <VImage
              :key="reloadKey"
              :src="img.src"
              :alt="img.name"
              :width="img.width"
              :height="img.height"
              :blurhash="customHash"
              :lazy="false"
              style="width: 100%; height: 100%"
            />
          </div>
        </div>
      </div>

      <!-- LQIP panel -->
      <div class="panel">
        <p class="panel-title">LQIP — base64 blur-up</p>

        <div style="font-size: 0.78rem; color: #8b949e; margin-bottom: 8px">
          20px JPEG → base64 → blur(20px) → fade to original
        </div>

        <div
          style="border-radius: 6px; overflow: hidden; margin-bottom: 14px"
          :style="{ background: `url(${img.placeholder}) center/cover` }"
        >
          <div
            style="
              aspect-ratio: 3/2;
              backdrop-filter: blur(8px);
              display: flex;
              align-items: center;
              justify-content: center;
            "
          >
            <span
              style="
                background: rgba(0, 0, 0, 0.5);
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 0.72rem;
              "
              >raw placeholder</span
            >
          </div>
        </div>

        <div style="font-size: 0.78rem; color: #8b949e; margin-bottom: 8px">
          Live preview with blur-up
        </div>
        <div style="aspect-ratio: 3/2; border-radius: 8px; overflow: hidden">
          <VImage
            :key="reloadKey"
            :src="img.src"
            :alt="img.name"
            :width="img.width"
            :height="img.height"
            :placeholder="img.placeholder"
            :lazy="false"
            style="width: 100%; height: 100%"
          />
        </div>

        <div style="margin-top: 16px" class="code-block">
          placeholder="data:image/jpeg;base64,..." filter: blur(20px) ← while loading opacity: 1 → 0
          ← on image load
        </div>
      </div>
    </div>

    <!-- ThumbHash — live demo -->
    <div class="panel">
      <p class="panel-title">ThumbHash — modern BlurHash alternative</p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px">
        <div>
          <div style="font-size: 0.82rem; color: #8b949e; line-height: 1.7; margin-bottom: 16px">
            ThumbHash is a newer format with
            <strong style="color: #e6edf3">alpha channel support</strong> (transparent PNGs), a
            <strong style="color: #e6edf3">shorter hash string</strong>, and
            <strong style="color: #e6edf3">better visual quality</strong> on photographs. Pass the
            hash directly as <code style="color: #e3b341">thumbhash</code> prop — VImage decodes it
            automatically.
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px">
            <div class="compare-cell">
              <div style="color: #484f58; font-size: 0.72rem; margin-bottom: 4px">BlurHash</div>
              <div style="color: #e6edf3; font-size: 0.78rem">Canvas</div>
              <div style="color: #8b949e; font-size: 0.75rem">No alpha</div>
              <div style="color: #8b949e; font-size: 0.75rem">~25 chars</div>
            </div>
            <div class="compare-cell compare-cell--active">
              <div style="color: #388bfd; font-size: 0.72rem; margin-bottom: 4px">ThumbHash</div>
              <div style="color: #e6edf3; font-size: 0.78rem">PNG data URL</div>
              <div style="color: #3fb950; font-size: 0.75rem">Alpha ✓</div>
              <div style="color: #3fb950; font-size: 0.75rem">~28 chars</div>
            </div>
          </div>

          <!-- Two previews side by side -->
          <div style="display: grid; grid-template-columns: 1fr; gap: 12px">
            <div>
              <div style="font-size: 0.78rem; color: #8b949e; margin-bottom: 8px">
                ThumbHash placeholder
              </div>
              <div style="aspect-ratio: 3/2; border-radius: 8px; overflow: hidden">
                <img
                  :src="thumbDataUrl"
                  alt=""
                  style="width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated"
                />
              </div>
            </div>
            <div>
              <div style="font-size: 0.78rem; color: #8b949e; margin-bottom: 8px">
                Live preview with fade
              </div>
              <div style="aspect-ratio: 3/2; border-radius: 8px; overflow: hidden">
                <VImage
                  :key="reloadKey"
                  :src="img.src"
                  :alt="img.name"
                  :width="img.width"
                  :height="img.height"
                  :thumbhash="img.thumbhash"
                  :lazy="false"
                  style="width: 100%; height: 100%"
                />
              </div>
            </div>
          </div>
          <div style="margin-top: 8px; font-size: 0.72rem; color: #484f58; word-break: break-all">
            {{ img.thumbhash }}
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px">
          <pre class="code-block" style="font-size: 0.72rem">
// Simplest — pass hash directly as prop
&lt;VImage
  src="/photo.jpg"
  thumbhash="{{ img.thumbhash }}"
  alt="Photo"
/&gt;</pre
          >

          <pre class="code-block" style="font-size: 0.72rem">
// Or decode manually (for custom markup)
import { decodeThumbHash } from 'vue-image-kit'

const dataUrl = decodeThumbHash(hash)
// → 'data:image/png;base64,…'</pre
          >

          <pre class="code-block" style="font-size: 0.72rem">
// Generate at build time — CLI flag
npx vue-image-kit generate \
  --input ./src/images \
  --thumbhash \
  --manifest ./src/assets/images.ts</pre
          >

          <pre class="code-block" style="font-size: 0.72rem">
// Or manually in Node.js
import { rgbaToThumbHash } from 'thumbhash'
import sharp from 'sharp'

const { data, info } = await sharp('photo.jpg')
  .resize(100, null, { withoutEnlargement: true })
  .ensureAlpha().raw().toBuffer({ resolveWithObject: true })

const hash = rgbaToThumbHash(info.width, info.height,
  new Uint8Array(data.buffer))
// → Uint8Array → base64 → store in manifest</pre
          >
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.compare-cell {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.compare-cell--active {
  border-color: #1f6feb;
  background: #0d1f33;
}
</style>
