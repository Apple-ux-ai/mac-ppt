import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import './styles/variables.css'
import './styles/common.css'
import './style.css'
import App from './App.vue'
import { translate } from './i18n'
import './mock-electron-api'

const app = createApp(App)
const pinia = createPinia()

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(pinia)
app.use(ElementPlus, {
  zIndex: 99999,
  size: 'default',
})

document.title = translate('app.meta.title')

app.mount('#app')
