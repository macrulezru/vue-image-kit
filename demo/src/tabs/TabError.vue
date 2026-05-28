<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

const reloadKey = ref(0)
const errorLog = ref<string[]>([])

function onError(label: string, e: Event) {
  const ts = new Date().toLocaleTimeString()
  errorLog.value.unshift(`[${ts}] @error fired on "${label}"`)
  if (errorLog.value.length > 6) errorLog.value.pop()
  console.error('VImage error:', e)
}

function reload() {
  reloadKey.value++
  errorLog.value = []
}

// ── Retry demo ────────────────────────────────────────────────
const maxRetries = ref(2)
const retryDelay = ref(500)
const retryKey = ref(0)
const retryAttempts = ref(0)
const retryLog = ref<string[]>([])
const retryStatus = ref<'idle' | 'running' | 'waiting' | 'error'>('idle')
const retryCountdown = ref(0)
let countdownInterval: ReturnType<typeof setInterval> | null = null

function clearCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
  retryCountdown.value = 0
}

function startCountdown(delayMs: number) {
  clearCountdown()
  retryCountdown.value = delayMs
  retryStatus.value = 'waiting'
  countdownInterval = setInterval(() => {
    retryCountdown.value = Math.max(0, retryCountdown.value - 50)
    if (retryCountdown.value <= 0) {
      clearCountdown()
      retryStatus.value = 'running'
    }
  }, 50)
}

function startRetryTest() {
  clearCountdown()
  retryAttempts.value = 0
  retryLog.value = []
  retryStatus.value = 'running'
  retryKey.value++
}

function onRetryError(_e: Event) {
  retryAttempts.value++
  const ts = new Date().toLocaleTimeString()
  const isLast = retryAttempts.value > maxRetries.value
  const delay = retryDelay.value * Math.pow(2, retryAttempts.value - 1)
  retryLog.value.unshift(
    isLast
      ? `[${ts}] Final failure after ${maxRetries.value} retr${maxRetries.value === 1 ? 'y' : 'ies'}`
      : `[${ts}] Attempt ${retryAttempts.value} failed — retrying in ${delay}ms`,
  )
  if (isLast) {
    retryStatus.value = 'error'
    clearCountdown()
  } else {
    startCountdown(delay)
  }
}

onUnmounted(clearCountdown)
</script>

<template>
  <div>
    <p class="tab-title">Error state & fallback slot</p>
    <p class="tab-desc">
      When the image fails to load VImage shows either the default fallback (grey rectangle + icon)
      or a fully custom <code style="color: #e3b341">#error</code> slot. The
      <code style="color: #e3b341">@error</code> event is emitted with the native
      <code style="color: #e3b341">Event</code> object.
    </p>

    <div style="margin-bottom: 16px">
      <button class="btn btn-primary" @click="reload">↺ Reload</button>
    </div>

    <div class="demo-grid" style="margin-bottom: 24px">
      <!-- Default fallback -->
      <div class="panel">
        <p class="panel-title">Default fallback (built-in)</p>
        <div style="aspect-ratio: 3/2; border-radius: 8px; overflow: hidden; margin-bottom: 12px">
          <VImage
            :key="reloadKey"
            src="/images/does-not-exist.jpg"
            alt="Missing image"
            :width="1200"
            :height="800"
            :lazy="false"
            style="width: 100%; height: 100%"
            @error="onError('default', $event)"
          />
        </div>
        <div class="code-block">
          &lt;VImage src="/broken.jpg" alt="Missing" /&gt; &lt;!-- Shows: grey rect + SVG icon
          --&gt;
        </div>
      </div>

      <!-- Custom slot -->
      <div class="panel">
        <p class="panel-title">Custom #error slot</p>
        <div style="aspect-ratio: 3/2; border-radius: 8px; overflow: hidden; margin-bottom: 12px">
          <VImage
            :key="reloadKey"
            src="/images/also-missing.jpg"
            alt="Missing image"
            :width="1200"
            :height="800"
            :lazy="false"
            style="width: 100%; height: 100%"
            @error="onError('custom slot', $event)"
          >
            <template #error>
              <div class="custom-error">
                <div class="custom-error-icon">📷</div>
                <p class="custom-error-title">Image unavailable</p>
                <p class="custom-error-sub">The resource could not be loaded</p>
              </div>
            </template>
          </VImage>
        </div>
        <div class="code-block">
          &lt;VImage src="/broken.jpg" alt="..."&gt; &lt;template #error&gt; &lt;div
          class="my-fallback"&gt; &lt;span&gt;📷&lt;/span&gt; &lt;p&gt;Image unavailable&lt;/p&gt;
          &lt;/div&gt; &lt;/template&gt; &lt;/VImage&gt;
        </div>
      </div>
    </div>

    <!-- Error log -->
    <div class="panel" style="margin-bottom: 28px">
      <p class="panel-title">@error event log</p>
      <div style="min-height: 60px">
        <div
          v-for="(entry, i) in errorLog"
          :key="i"
          style="
            font-size: 0.78rem;
            color: #f85149;
            padding: 4px 0;
            border-bottom: 1px solid #21262d;
          "
        >
          {{ entry }}
        </div>
        <div v-if="!errorLog.length" style="font-size: 0.78rem; color: #484f58">
          Waiting for @error events…
        </div>
      </div>
    </div>

    <!-- ── Retry demo ── -->
    <p class="tab-title" style="font-size: 1rem; margin-bottom: 6px">
      Error retry — maxRetries prop
    </p>
    <p class="tab-desc" style="margin-bottom: 20px">
      When <code style="color: #e3b341">maxRetries</code> is set, failed loads are retried
      automatically with exponential backoff.
      <strong style="color: #e6edf3">Configure the sliders, then click "Start Test"</strong>
      to mount a broken image and watch the retry sequence unfold in real time.
    </p>

    <div style="display: grid; grid-template-columns: 310px 1fr; gap: 20px; align-items: start">
      <!-- Controls -->
      <div class="panel">
        <p class="panel-title">Retry config</p>

        <div class="control-row">
          <span class="control-label">maxRetries</span>
          <input
            type="range"
            min="0"
            max="4"
            v-model.number="maxRetries"
            style="flex: 1; accent-color: #1f6feb"
          />
          <code style="font-size: 0.82rem; color: #e6edf3; min-width: 16px; text-align: right">{{
            maxRetries
          }}</code>
        </div>

        <div class="control-row">
          <span class="control-label">retryDelay</span>
          <select class="control-select" v-model.number="retryDelay">
            <option :value="200">200ms</option>
            <option :value="500">500ms</option>
            <option :value="1000">1000ms</option>
          </select>
        </div>

        <div style="margin-top: 16px; font-size: 0.75rem; color: #484f58; line-height: 1.6">
          Backoff: attempt 1 = {{ retryDelay }}ms, attempt 2 = {{ retryDelay * 2 }}ms, attempt 3 =
          {{ retryDelay * 4 }}ms…
        </div>

        <pre class="code-block" style="font-size: 0.72rem; margin-top: 16px">
&lt;VImage
  src="/broken.jpg"
  :max-retries="{{ maxRetries }}"
  :retry-delay="{{ retryDelay }}"
/&gt;</pre>

        <button
          class="btn btn-primary"
          style="margin-top: 16px; width: 100%"
          @click="startRetryTest"
        >
          ▶ Start Test
        </button>
      </div>

      <!-- Preview + log -->
      <div style="display: flex; flex-direction: column; gap: 16px">
        <div class="panel">
          <p class="panel-title" style="display: flex; align-items: center; gap: 10px">
            Broken image with retry
            <!-- status badge -->
            <span v-if="retryStatus === 'idle'" class="badge badge-idle">idle</span>
            <span v-else-if="retryStatus === 'running'" class="badge badge-loading">
              loading — {{ Math.min(retryAttempts + 1, maxRetries + 1) }} / {{ maxRetries + 1 }}
            </span>
            <span v-else-if="retryStatus === 'waiting'" class="badge badge-loading">
              waiting {{ (retryCountdown / 1000).toFixed(1) }}s…
            </span>
            <span v-else-if="retryStatus === 'error'" class="badge badge-error">failed</span>
          </p>

          <!-- placeholder shown before test starts -->
          <div
            v-if="retryStatus === 'idle'"
            style="
              aspect-ratio: 3/2;
              border-radius: 8px;
              overflow: hidden;
              max-width: 360px;
              background: #0d1117;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 1px dashed #30363d;
            "
          >
            <span style="font-size: 0.82rem; color: #484f58">Press "Start Test" to begin</span>
          </div>

          <div
            v-else
            style="aspect-ratio: 3/2; border-radius: 8px; overflow: hidden; max-width: 360px"
          >
            <VImage
              :key="retryKey"
              src="/images/does-not-exist-retry.jpg"
              alt="Broken"
              :width="1200"
              :height="800"
              :lazy="false"
              :max-retries="maxRetries"
              :retry-delay="retryDelay"
              style="width: 100%; height: 100%"
              @error="onRetryError"
            />
          </div>
        </div>

        <div class="panel">
          <p class="panel-title">Retry log</p>
          <div style="min-height: 60px">
            <!-- countdown bar -->
            <div
              v-if="retryStatus === 'waiting'"
              style="
                margin-bottom: 8px;
                height: 4px;
                border-radius: 2px;
                background: #21262d;
                overflow: hidden;
              "
            >
              <div
                class="countdown-bar"
                :style="{
                  width:
                    retryDelay * Math.pow(2, retryAttempts - 1) > 0
                      ? (retryCountdown / (retryDelay * Math.pow(2, retryAttempts - 1))) * 100 +
                        '%'
                      : '0%',
                }"
              />
            </div>

            <div
              v-for="(entry, i) in retryLog"
              :key="i"
              style="font-size: 0.78rem; padding: 4px 0; border-bottom: 1px solid #21262d"
              :style="{ color: i === 0 && retryStatus === 'error' ? '#f85149' : '#e3b341' }"
            >
              {{ entry }}
            </div>
            <div v-if="!retryLog.length" style="font-size: 0.78rem; color: #484f58">
              <template v-if="retryStatus === 'idle'">
                Click "Start Test" — the broken URL will fail {{ maxRetries + 1 }} time{{
                  maxRetries !== 0 ? 's' : ''
                }}
                before giving up.
              </template>
              <template v-else>Loading…</template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-error {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, #1a1f2e 0%, #0f1117 100%);
}
.custom-error-icon {
  font-size: 2.5rem;
}
.custom-error-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #e6edf3;
}
.custom-error-sub {
  font-size: 0.78rem;
  color: #8b949e;
}
.countdown-bar {
  height: 100%;
  background: #1f6feb;
  border-radius: 2px;
  transition: width 0.05s linear;
}
</style>
