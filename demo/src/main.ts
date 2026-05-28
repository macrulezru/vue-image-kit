import { createApp } from 'vue'
import { VImageKitPlugin } from 'vue-image-kit'
import App from './App.vue'

const app = createApp(App)

app.use(VImageKitPlugin, {
  breakpoints: {
    sm: '(max-width: 640px)',
    md: '(max-width: 1024px)',
    lg: '(min-width: 1025px)',
  },
})

app.mount('#app')
