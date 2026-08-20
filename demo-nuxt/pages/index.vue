<script setup lang="ts">
// Every composable/utility below is used with ZERO explicit imports — proof
// that the Nuxt module's addImports() actually wired auto-imports for real,
// not just that the types compile.
const srcsetSample = generateSrcset('/images/photo-1.jpg', [400, 800, 1200])
const sizesSample = buildSizes({ sm: '100vw', default: '50vw' }, { sm: '(max-width: 640px)' })
const { preload, isComplete } = useImagePreloader()

const onDemandUrl = '/_vik/image?src=/images/photo-1.jpg&w=300&format=webp'
const onDemandResult = ref<{ status: number; contentType: string | null; width?: number; height?: number } | null>(null)

async function checkOnDemand() {
  const res = await fetch(onDemandUrl)
  const contentType = res.headers.get('content-type')
  onDemandResult.value = { status: res.status, contentType }
}
</script>

<template>
  <main style="max-width: 720px; margin: 0 auto; padding: 24px; font-family: system-ui, sans-serif;">
    <h1>vue-image-kit — Nuxt demo</h1>
    <p data-testid="ssr-marker">
      This paragraph is present in the server-rendered HTML — view source /
      curl this page to confirm SSR actually ran `VImage`'s `isSSR` branch.
    </p>

    <section>
      <h2>1. &lt;VImage&gt; — module-registered component</h2>
      <VImage
        data-testid="basic-image"
        src="/images/photo-1.jpg"
        alt="Sample photo"
        :width="400"
        :height="267"
        style="max-width: 300px"
      />
    </section>

    <section>
      <h2>2. Breakpoints — art direction from module config</h2>
      <p>
        <code>vueImageKit.breakpoints</code> in <code>nuxt.config.ts</code> defines
        <code>sm</code>/<code>md</code>; this <code>&lt;VImage&gt;</code> only passes the
        breakpoint keys, no media queries.
      </p>
      <VImage
        data-testid="breakpoints-image"
        src="/images/photo-1.jpg"
        alt="Art-directed photo"
        :sources="{ sm: '/images/photo-2.jpg' }"
        :width="400"
        :height="267"
        style="max-width: 300px"
      />
    </section>

    <section>
      <h2>3. Auto-imported composables/utilities</h2>
      <p data-testid="autoimport-srcset"><code>generateSrcset()</code>: {{ srcsetSample }}</p>
      <p data-testid="autoimport-sizes"><code>buildSizes()</code>: {{ sizesSample }}</p>
      <p data-testid="autoimport-preloader">
        <code>useImagePreloader()</code> resolved: {{ typeof preload === 'function' }},
        isComplete: {{ isComplete }}
      </p>
    </section>

    <section>
      <h2>4. On-demand server (<code>onDemandServer</code> + <code>loader="server"</code>)</h2>
      <VImage
        data-testid="ondemand-image"
        src="/images/photo-1.jpg"
        alt="On-demand resized photo"
        loader="server"
        :widths="[300, 600]"
        style="max-width: 300px"
      />
      <p>
        <button data-testid="ondemand-check" @click="checkOnDemand">
          Fetch {{ onDemandUrl }} directly
        </button>
      </p>
      <p v-if="onDemandResult" data-testid="ondemand-result">
        status: {{ onDemandResult.status }}, content-type: {{ onDemandResult.contentType }}
      </p>
    </section>

    <section>
      <h2>5. v-lazy-img directive</h2>
      <div
        v-lazy-img="{ src: '/images/photo-2.jpg' }"
        data-testid="directive-bg"
        style="width: 200px; height: 120px; background-size: cover;"
      />
    </section>
  </main>
</template>
