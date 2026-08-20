<script setup lang="ts">
import { images } from '../assets/images'

const img = images[0]
</script>

<template>
  <div>
    <p class="tab-title">Layout presets & priority</p>
    <p class="tab-desc">
      <code style="color: #e3b341">layout</code> switches how the wrapper is
      sized — <code style="color: #e3b341">fixed</code> (exact box),
      <code style="color: #e3b341">responsive</code> (fills the container,
      auto <code style="color: #e3b341">sizes</code>), or
      <code style="color: #e3b341">fill</code> (absolutely fills a positioned
      parent). <code style="color: #e3b341">priority</code> is the LCP/hero
      shorthand — forces eager loading and <code style="color: #e3b341">fetchpriority="high"</code>.
    </p>

    <div class="layout-grid">
      <div class="panel">
        <p class="panel-title">layout="fixed"</p>
        <VImage
          data-testid="layout-fixed"
          :src="img.src"
          :alt="img.name"
          :width="240"
          :height="160"
          layout="fixed"
          :blurhash="img.blurhash"
        />
        <p class="layout-note">Exact 240×160 box, no responsive scaling.</p>
      </div>

      <div class="panel">
        <p class="panel-title">layout="responsive"</p>
        <div style="max-width: 320px">
          <VImage
            data-testid="layout-responsive"
            :src="img.src"
            :alt="img.name"
            :width="img.width"
            :height="img.height"
            :widths="[320, 640, 960]"
            layout="responsive"
            :blurhash="img.blurhash"
          />
        </div>
        <p class="layout-note">Fills its container width; auto-generates <code>sizes</code>.</p>
      </div>

      <div class="panel">
        <p class="panel-title">layout="fill"</p>
        <div data-testid="layout-fill-parent" class="fill-parent">
          <VImage
            data-testid="layout-fill"
            :src="img.src"
            :alt="img.name"
            layout="fill"
            fit="cover"
            :blurhash="img.blurhash"
          />
        </div>
        <p class="layout-note">Absolutely fills the positioned parent above — no width/height needed.</p>
      </div>

      <div class="panel">
        <p class="panel-title">priority</p>
        <VImage
          data-testid="priority-image"
          :src="img.src"
          :alt="img.name"
          :width="240"
          :height="160"
          priority
          :blurhash="img.blurhash"
        />
        <p class="layout-note">Eager, <code>fetchpriority="high"</code>, <code>decoding="sync"</code> — no IntersectionObserver.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}
.layout-note {
  color: #8b949e;
  font-size: 0.78rem;
  margin-top: 10px;
  line-height: 1.6;
}
.fill-parent {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: #0d1117;
}
</style>
