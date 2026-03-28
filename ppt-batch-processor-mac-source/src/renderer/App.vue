<template>
  <div id="app">
    <SplashScreen v-if="showSplash" />
    
    <template v-else>
      <TitleBar />
      <div class="layout-container">
        <template v-if="store.showHomePage">
          <main class="home-content">
            <HomePage />
          </main>
        </template>

        <template v-else>
          <main class="main-content">
            <TaskConfig />
          </main>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useAppStore } from './store/app'
import { useI18n } from './i18n'
import TitleBar from './components/TitleBar.vue'
import HomePage from './components/HomePage.vue'
import TaskConfig from './components/TaskConfig.vue'
import SplashScreen from './components/SplashScreen.vue'

import './types/electron.d.ts'

const store = useAppStore()
const { locale, setLocale, t } = useI18n()

const showSplash = ref(true)

watch(
  locale,
  () => {
    document.title = t('app.meta.title')
  },
  { immediate: true }
)

onMounted(() => {
  store.loadSettings()
  setLocale(store.settings.language || 'zh-CN')

  if (window.electronAPI) {
    window.electronAPI.onProgressUpdate((progress) => {
      console.log('收到进度更新:', progress)
      
      if (progress.progress) {
        store.updateDetailedProgress(progress.progress)
      } else {
        store.updateProgress(progress)
      }
    })

    window.electronAPI.onFileCompleted((result) => {
      console.log('文件处理完成:', result)
      store.addFileResult(result)
    })

    window.electronAPI.onTaskCompleted((summary) => {
      console.log('任务全部完成:', summary)
      store.isProcessing = false
      if (store.progress) {
        store.progress.percentage = 100
      }
      if (summary.results && Array.isArray(summary.results)) {
        summary.results.forEach((result: any) => {
          store.addFileResult(result)
        })
      }
    })

    console.log('✓ IPC 事件监听器已设置')
  }
  
  setTimeout(() => {
    showSplash.value = false
  }, 2500)
})

onUnmounted(() => {
  if (window.electronAPI) {
    window.electronAPI.removeProgressListener()
    window.electronAPI.removeFileCompletedListener()
    window.electronAPI.removeTaskCompletedListener()
  }
})
</script>

<style scoped>
.layout-container {
  display: flex;
  height: calc(100vh - 40px);
  margin-top: 40px;
  background: #f5f7fa;
  overflow: hidden;
}

.home-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  height: 100%;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  height: 100%;
}
</style>
