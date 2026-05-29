<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  cloudinary,
  imgix,
  bunny,
  sanity,
  storyblok,
  contentful,
  vercel,
  cloudflare,
  imagekit,
  twicpics,
  netlify,
  gumlet,
} from 'vue-image-kit/cdn'

type CdnId =
  | 'cloudinary'
  | 'imgix'
  | 'bunny'
  | 'sanity'
  | 'storyblok'
  | 'contentful'
  | 'vercel'
  | 'cloudflare'
  | 'imagekit'
  | 'twicpics'
  | 'netlify'
  | 'gumlet'

const selectedCdn = ref<CdnId>('cloudinary')
const path = ref('/photos/hero.jpg')
const widthsInput = ref('400,800,1200')
const quality = ref(80)
const format = ref<'auto' | 'webp' | 'avif' | 'jpg'>('auto')
const cloudName = ref('my-cloud')
const imgixBase = ref('https://mysite.imgix.net')
const bunnyBase = ref('https://myzone.b-cdn.net')
const sanityProject = ref('abc123')
const sanityDataset = ref('production')
const storyblokUrl = ref('https://a.storyblok.com/f/12345/hero.jpg')
const contentfulUrl = ref('https://images.ctfassets.net/space/token/hero.jpg')
const vercelOrigin = ref('https://myapp.vercel.app')
const cloudflareBase = ref('https://example.com')
const imagekitBase = ref('https://ik.imagekit.io/demo')
const twicpicsBase = ref('https://demo.twic.pics')
const netlifyOrigin = ref('https://myapp.netlify.app')
const gumletBase = ref('https://demo.gumlet.io')

const cdns = [
  { id: 'cloudinary', label: 'Cloudinary', docs: 'res.cloudinary.com' },
  { id: 'imgix', label: 'imgix', docs: 'imgix.net' },
  { id: 'bunny', label: 'Bunny CDN', docs: 'b-cdn.net' },
  { id: 'sanity', label: 'Sanity', docs: 'cdn.sanity.io' },
  { id: 'storyblok', label: 'Storyblok', docs: 'img2.storyblok.com' },
  { id: 'contentful', label: 'Contentful', docs: 'images.ctfassets.net' },
  { id: 'vercel', label: 'Vercel', docs: '/_vercel/image' },
  { id: 'cloudflare', label: 'Cloudflare', docs: '/cdn-cgi/image' },
  { id: 'imagekit', label: 'ImageKit', docs: 'ik.imagekit.io' },
  { id: 'twicpics', label: 'TwicPics', docs: 'twic.pics' },
  { id: 'netlify', label: 'Netlify', docs: '/.netlify/images' },
  { id: 'gumlet', label: 'Gumlet', docs: 'gumlet.io' },
] as const

const widths = computed(() =>
  widthsInput.value
    .split(',')
    .map((w) => parseInt(w.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0),
)

function getAdapter() {
  const opts = { quality: quality.value, format: format.value }
  switch (selectedCdn.value) {
    case 'cloudinary':
      return cloudinary({ cloudName: cloudName.value })
    case 'imgix':
      return imgix(imgixBase.value)
    case 'bunny':
      return bunny(bunnyBase.value)
    case 'sanity':
      return sanity({ projectId: sanityProject.value, dataset: sanityDataset.value })
    case 'storyblok':
      return storyblok()
    case 'contentful':
      return contentful()
    case 'vercel':
      return vercel({ origin: vercelOrigin.value })
    case 'cloudflare':
      return cloudflare(cloudflareBase.value)
    case 'imagekit':
      return imagekit(imagekitBase.value)
    case 'twicpics':
      return twicpics(twicpicsBase.value)
    case 'netlify':
      return netlify({ origin: netlifyOrigin.value })
    case 'gumlet':
      return gumlet(gumletBase.value)
  }
}

function getPath() {
  if (selectedCdn.value === 'storyblok') return storyblokUrl.value
  if (selectedCdn.value === 'contentful') return contentfulUrl.value
  return path.value
}

const generatedUrl = computed(() => {
  try {
    const opts = {
      quality: quality.value,
      ...(format.value !== 'auto' ? { format: format.value } : { format: 'auto' as const }),
    }
    return getAdapter().url(getPath(), { ...opts, width: widths.value[0] })
  } catch {
    return '— (invalid config)'
  }
})

const generatedSrcset = computed(() => {
  if (widths.value.length === 0) return '— (no valid widths)'
  try {
    const opts = {
      quality: quality.value,
      ...(format.value !== 'auto' ? { format: format.value } : { format: 'auto' as const }),
    }
    return getAdapter().srcset(getPath(), widths.value, opts)
  } catch {
    return '— (invalid config)'
  }
})

const importSnippet = computed(() => {
  return `import { ${selectedCdn.value} } from 'vue-image-kit/cdn'`
})

const usageSnippet = computed(() => {
  const p = getPath()
  const w = widths.value
  switch (selectedCdn.value) {
    case 'cloudinary':
      return `const cdn = cloudinary({ cloudName: '${cloudName.value}' })\n\ncdn.url('${p}', { width: ${w[0] ?? 800}, format: '${format.value}' })\ncdn.srcset('${p}', [${w.join(', ')}])`
    case 'imgix':
      return `const cdn = imgix('${imgixBase.value}')\n\ncdn.url('${p}', { width: ${w[0] ?? 800}, format: '${format.value}' })\ncdn.srcset('${p}', [${w.join(', ')}])`
    case 'bunny':
      return `const cdn = bunny('${bunnyBase.value}')\n\ncdn.url('${p}', { width: ${w[0] ?? 800}, quality: ${quality.value} })\ncdn.srcset('${p}', [${w.join(', ')}])`
    case 'sanity':
      return `const cdn = sanity({ projectId: '${sanityProject.value}', dataset: '${sanityDataset.value}' })\n\ncdn.url('image-id.jpg', { width: ${w[0] ?? 800} })\ncdn.srcset('image-id.jpg', [${w.join(', ')}])`
    case 'storyblok':
      return `const cdn = storyblok()\n\ncdn.url('${storyblokUrl.value}', { width: ${w[0] ?? 800} })\ncdn.srcset('${storyblokUrl.value}', [${w.join(', ')}])`
    case 'contentful':
      return `const cdn = contentful()\n\ncdn.url('${contentfulUrl.value}', { width: ${w[0] ?? 800} })\ncdn.srcset('${contentfulUrl.value}', [${w.join(', ')}])`
    case 'vercel':
      return `const cdn = vercel({ origin: '${vercelOrigin.value}' })\n\ncdn.url('/photo.jpg', { width: ${w[0] ?? 800}, quality: ${quality.value} })\ncdn.srcset('/photo.jpg', [${w.join(', ')}])`
    case 'cloudflare':
      return `const cdn = cloudflare('${cloudflareBase.value}')\n\ncdn.url('${p}', { width: ${w[0] ?? 800}, format: '${format.value}' })\ncdn.srcset('${p}', [${w.join(', ')}])`
    case 'imagekit':
      return `const cdn = imagekit('${imagekitBase.value}')\n\ncdn.url('${p}', { width: ${w[0] ?? 800}, format: '${format.value}' })\ncdn.srcset('${p}', [${w.join(', ')}])`
    case 'twicpics':
      return `const cdn = twicpics('${twicpicsBase.value}')\n\ncdn.url('${p}', { width: ${w[0] ?? 800}, format: '${format.value}' })\ncdn.srcset('${p}', [${w.join(', ')}])`
    case 'netlify':
      return `const cdn = netlify({ origin: '${netlifyOrigin.value}' })\n\ncdn.url('/photo.jpg', { width: ${w[0] ?? 800}, format: '${format.value}', quality: ${quality.value} })\ncdn.srcset('/photo.jpg', [${w.join(', ')}])`
    case 'gumlet':
      return `const cdn = gumlet('${gumletBase.value}')\n\ncdn.url('${p}', { width: ${w[0] ?? 800}, format: '${format.value}' })\ncdn.srcset('${p}', [${w.join(', ')}])`
  }
})
</script>

<template>
  <div>
    <p class="tab-title">CDN adapters</p>
    <p class="tab-desc">
      <code style="color: #e3b341">vue-image-kit/cdn</code> provides URL builders for popular image
      CDNs — pure functions, zero dependencies. All adapters share the same
      <code style="color: #e3b341">.url()</code> /
      <code style="color: #e3b341">.srcset()</code> interface.
    </p>

    <!-- CDN selector -->
    <div class="cdn-selector">
      <button
        v-for="cdn in cdns"
        :key="cdn.id"
        class="cdn-btn"
        :class="{ active: selectedCdn === cdn.id }"
        @click="selectedCdn = cdn.id as CdnId"
      >
        {{ cdn.label }}
        <span class="cdn-btn-domain">{{ cdn.docs }}</span>
      </button>
    </div>

    <div class="cdn-layout">
      <!-- Left: config -->
      <div class="panel cdn-config">
        <p class="panel-title">Configuration</p>

        <!-- CDN-specific fields -->
        <template v-if="selectedCdn === 'cloudinary'">
          <div class="control-row">
            <span class="control-label">cloudName</span>
            <input class="control-input" style="flex: 1" v-model="cloudName" />
          </div>
          <div class="control-row">
            <span class="control-label">path</span>
            <input class="control-input" style="flex: 1" v-model="path" />
          </div>
        </template>

        <template v-else-if="selectedCdn === 'imgix'">
          <div class="control-row">
            <span class="control-label">base URL</span>
            <input class="control-input" style="flex: 1" v-model="imgixBase" />
          </div>
          <div class="control-row">
            <span class="control-label">path</span>
            <input class="control-input" style="flex: 1" v-model="path" />
          </div>
        </template>

        <template v-else-if="selectedCdn === 'bunny'">
          <div class="control-row">
            <span class="control-label">base URL</span>
            <input class="control-input" style="flex: 1" v-model="bunnyBase" />
          </div>
          <div class="control-row">
            <span class="control-label">path</span>
            <input class="control-input" style="flex: 1" v-model="path" />
          </div>
        </template>

        <template v-else-if="selectedCdn === 'sanity'">
          <div class="control-row">
            <span class="control-label">projectId</span>
            <input class="control-input" style="flex: 1" v-model="sanityProject" />
          </div>
          <div class="control-row">
            <span class="control-label">dataset</span>
            <input class="control-input" style="flex: 1" v-model="sanityDataset" />
          </div>
          <div class="control-row">
            <span class="control-label">asset id</span>
            <input
              class="control-input"
              style="flex: 1"
              v-model="path"
              placeholder="image-abc123-800x600-jpg"
            />
          </div>
        </template>

        <template v-else-if="selectedCdn === 'storyblok'">
          <div class="control-row">
            <span class="control-label">full URL</span>
            <input class="control-input" style="flex: 1" v-model="storyblokUrl" />
          </div>
        </template>

        <template v-else-if="selectedCdn === 'contentful'">
          <div class="control-row">
            <span class="control-label">full URL</span>
            <input class="control-input" style="flex: 1" v-model="contentfulUrl" />
          </div>
        </template>

        <template v-else-if="selectedCdn === 'vercel'">
          <div class="control-row">
            <span class="control-label">origin</span>
            <input class="control-input" style="flex: 1" v-model="vercelOrigin" />
          </div>
          <div class="control-row">
            <span class="control-label">path</span>
            <input class="control-input" style="flex: 1" v-model="path" />
          </div>
        </template>

        <template v-else-if="selectedCdn === 'cloudflare'">
          <div class="control-row">
            <span class="control-label">origin</span>
            <input class="control-input" style="flex: 1" v-model="cloudflareBase" />
          </div>
          <div class="control-row">
            <span class="control-label">path</span>
            <input class="control-input" style="flex: 1" v-model="path" />
          </div>
        </template>

        <template v-else-if="selectedCdn === 'imagekit'">
          <div class="control-row">
            <span class="control-label">URL endpoint</span>
            <input class="control-input" style="flex: 1" v-model="imagekitBase" />
          </div>
          <div class="control-row">
            <span class="control-label">path</span>
            <input class="control-input" style="flex: 1" v-model="path" />
          </div>
        </template>

        <template v-else-if="selectedCdn === 'twicpics'">
          <div class="control-row">
            <span class="control-label">domain</span>
            <input class="control-input" style="flex: 1" v-model="twicpicsBase" />
          </div>
          <div class="control-row">
            <span class="control-label">path</span>
            <input class="control-input" style="flex: 1" v-model="path" />
          </div>
        </template>

        <template v-else-if="selectedCdn === 'netlify'">
          <div class="control-row">
            <span class="control-label">origin</span>
            <input class="control-input" style="flex: 1" v-model="netlifyOrigin" />
          </div>
          <div class="control-row">
            <span class="control-label">path</span>
            <input class="control-input" style="flex: 1" v-model="path" />
          </div>
        </template>

        <template v-else-if="selectedCdn === 'gumlet'">
          <div class="control-row">
            <span class="control-label">base URL</span>
            <input class="control-input" style="flex: 1" v-model="gumletBase" />
          </div>
          <div class="control-row">
            <span class="control-label">path</span>
            <input class="control-input" style="flex: 1" v-model="path" />
          </div>
        </template>

        <!-- Common options -->
        <div class="config-divider" />

        <div class="control-row">
          <span class="control-label">widths</span>
          <input
            class="control-input"
            style="flex: 1"
            v-model="widthsInput"
            placeholder="400,800,1200"
          />
        </div>

        <div class="control-row" v-if="selectedCdn !== 'vercel'">
          <span class="control-label">format</span>
          <select class="control-select" v-model="format">
            <option value="auto">auto</option>
            <option value="webp">webp</option>
            <option value="avif">avif</option>
            <option value="jpg">jpg</option>
          </select>
        </div>

        <div class="control-row">
          <span class="control-label">quality</span>
          <input
            type="range"
            min="1"
            max="100"
            v-model.number="quality"
            style="flex: 1; accent-color: #1f6feb"
          />
          <code style="font-size: 0.82rem; color: #e6edf3; min-width: 30px; text-align: right">{{
            quality
          }}</code>
        </div>
      </div>

      <!-- Right: output -->
      <div style="display: flex; flex-direction: column; gap: 16px; min-width: 0">
        <!-- URL output -->
        <div class="panel">
          <p class="panel-title">
            Generated URL <span style="color: #484f58; font-weight: 400">(first width)</span>
          </p>
          <div class="url-output">{{ generatedUrl }}</div>
        </div>

        <!-- Srcset output -->
        <div class="panel">
          <p class="panel-title">Generated srcset</p>
          <div class="url-output srcset-output">{{ generatedSrcset }}</div>
        </div>

        <!-- Code snippet -->
        <div class="panel">
          <p class="panel-title">Usage</p>
          <pre class="code-block" style="font-size: 0.72rem; margin-bottom: 12px">{{
            importSnippet
          }}</pre>
          <pre class="code-block" style="font-size: 0.72rem">{{ usageSnippet }}</pre>
        </div>

        <!-- VImage integration -->
        <div class="panel">
          <p class="panel-title">With VImage</p>
          <pre class="code-block" style="font-size: 0.72rem">
&lt;VImage
  :src="cdn.url('{{ getPath() }}', { width: {{ widths[0] ?? 800 }} })"
  :srcset="cdn.srcset('{{ getPath() }}', [{{ widths.join(', ') }}])"
  sizes="(max-width: 768px) 100vw, 50vw"
  alt="Photo"
/&gt;</pre
          >
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cdn-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
}

.cdn-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 16px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  color: #8b949e;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition:
    border-color 0.15s,
    color 0.15s,
    background 0.15s;
}
.cdn-btn:hover {
  border-color: #8b949e;
  color: #c9d1d9;
}
.cdn-btn.active {
  border-color: #1f6feb;
  background: #1f3049;
  color: #f0f6fc;
}
.cdn-btn-domain {
  font-size: 0.65rem;
  color: #484f58;
  font-weight: 400;
}
.cdn-btn.active .cdn-btn-domain {
  color: #388bfd;
}

.cdn-layout {
  display: grid;
  grid-template-columns: 330px 1fr;
  gap: 20px;
  align-items: start;
}

.cdn-config {
  position: sticky;
  top: 20px;
}

.config-divider {
  height: 1px;
  background: #21262d;
  margin: 12px 0;
}

.url-output {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 10px 14px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 0.75rem;
  color: #79c0ff;
  word-break: break-all;
  line-height: 1.6;
}

.srcset-output {
  color: #3fb950;
}
</style>
