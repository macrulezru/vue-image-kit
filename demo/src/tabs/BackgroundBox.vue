<script setup lang="ts">
import { useBackgroundImage } from 'vue-image-kit'

const props = defineProps<{
  src: string
  densities: number[]
  placeholder?: string
  lazy: boolean
}>()

const { target, style, status } = useBackgroundImage(props.src, {
  densities: props.densities,
  ...(props.placeholder ? { placeholder: props.placeholder } : {}),
  lazy: props.lazy,
  rootMargin: '0px',
})
</script>

<template>
  <div ref="target" class="bg-box" :style="style">
    <span class="badge" :class="`badge-${status}`">{{ status }}</span>
  </div>
</template>

<style scoped>
.bg-box {
  height: 280px;
  border-radius: 10px;
  display: flex;
  align-items: flex-end;
  padding: 14px;
}
</style>
