<template>
  <Transition name="splash-fade">
    <div v-if="visible" class="splash-screen">
      <div class="splash-background">
        <div class="bg-gradient"></div>
        <div class="bg-particles">
          <div v-for="i in 20" :key="i" class="particle" :style="getParticleStyle(i)"></div>
        </div>
      </div>

      <div class="splash-content">
        <div class="logo-container">
          <div class="logo-ring ring-1"></div>
          <div class="logo-ring ring-2"></div>
          <div class="logo-ring ring-3"></div>
          <div class="logo-core">
            <img :src="logoImage" alt="Logo" class="logo-image" />
          </div>
        </div>

        <div class="app-info">
          <h1 class="app-name">{{ t('PPT 批量处理工具') }}</h1>
          <p class="app-tagline">{{ t('高效 · 专业 · 智能') }}</p>
        </div>

        <div class="loading-bar">
          <div class="loading-progress"></div>
        </div>

        <div class="loading-tips">
          <Transition name="tip-fade" mode="out-in">
            <span :key="currentTipIndex">{{ tips[currentTipIndex] }}</span>
          </Transition>
        </div>
      </div>

      <div class="splash-footer">
        <span class="version">v1.0.0</span>
        <span class="brand">{{ t('鲲穹AI 出品') }}</span>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import logoImage from '../assets/icon.png'
import { useI18n } from '../i18n'

const { t } = useI18n()

const visible = ref(true)
const currentTipIndex = ref(0)

const tips = computed(() => [
  t('正在加载核心组件...'),
  t('正在初始化处理引擎...'),
  t('正在检查系统环境...'),
  t('准备就绪，即将启动...'),
])

let tipTimer: number | null = null

function getParticleStyle(index: number) {
  const size = Math.random() * 4 + 2
  const x = Math.random() * 100
  const y = Math.random() * 100
  const delay = Math.random() * 5
  const duration = Math.random() * 10 + 10

  return {
    width: `${size}px`,
    height: `${size}px`,
    left: `${x}%`,
    top: `${y}%`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
  }
}

onMounted(() => {
  tipTimer = window.setInterval(() => {
    if (currentTipIndex.value < tips.value.length - 1) {
      currentTipIndex.value++
    }
  }, 600)

  setTimeout(() => {
    visible.value = false
  }, 2400)
})

onUnmounted(() => {
  if (tipTimer) {
    clearInterval(tipTimer)
  }
})
</script>

<style scoped>
.splash-screen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.splash-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #0f172a;
}

.bg-gradient {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(ellipse at 20% 20%, rgba(102, 126, 234, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 80%, rgba(118, 75, 162, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 70%);
}

.bg-particles {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.particle {
  position: absolute;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  animation: float-particle linear infinite;
}

@keyframes float-particle {
  0%,
  100% {
    transform: translateY(0) translateX(0);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(-100vh) translateX(50px);
    opacity: 0;
  }
}

.splash-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
}

.logo-container {
  position: relative;
  width: 120px;
  height: 120px;
  margin-bottom: 32px;
}

.logo-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 2px solid transparent;
}

.ring-1 {
  width: 140px;
  height: 140px;
  border-top-color: #667eea;
  border-right-color: #667eea;
  animation: spin 2s linear infinite;
}

.ring-2 {
  width: 160px;
  height: 160px;
  border-bottom-color: #764ba2;
  border-left-color: #764ba2;
  animation: spin 3s linear infinite reverse;
}

.ring-3 {
  width: 180px;
  height: 180px;
  border-top-color: rgba(102, 126, 234, 0.5);
  animation: spin 4s linear infinite;
}

@keyframes spin {
  0% {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  100% {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

.logo-core {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 0 40px rgba(102, 126, 234, 0.4),
    0 0 80px rgba(118, 75, 162, 0.2);
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%,
  100% {
    box-shadow:
      0 0 40px rgba(102, 126, 234, 0.4),
      0 0 80px rgba(118, 75, 162, 0.2);
  }
  50% {
    box-shadow:
      0 0 60px rgba(102, 126, 234, 0.6),
      0 0 100px rgba(118, 75, 162, 0.4);
  }
}

.logo-image {
  width: 60px;
  height: 60px;
  object-fit: contain;
}

.app-info {
  text-align: center;
  margin-bottom: 32px;
}

.app-name {
  font-size: 28px;
  font-weight: 700;
  color: white;
  margin: 0 0 8px 0;
  letter-spacing: 2px;
  text-shadow: 0 2px 20px rgba(102, 126, 234, 0.5);
}

.app-tagline {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
  letter-spacing: 4px;
}

.loading-bar {
  width: 200px;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 24px;
}

.loading-progress {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2, #667eea);
  background-size: 200% 100%;
  animation:
    loading 2s ease-in-out forwards,
    shimmer 1s linear infinite;
}

@keyframes loading {
  0% {
    width: 0%;
  }
  100% {
    width: 100%;
  }
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.loading-tips {
  height: 20px;
  text-align: center;
}

.loading-tips span {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.splash-footer {
  position: absolute;
  bottom: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.version {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
}

.brand {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 1px;
}

.splash-fade-enter-active {
  animation: splash-in 0.5s ease-out;
}

.splash-fade-leave-active {
  animation: splash-out 0.5s ease-in forwards;
}

@keyframes splash-in {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@keyframes splash-out {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    visibility: hidden;
  }
}

.tip-fade-enter-active,
.tip-fade-leave-active {
  transition: all 0.3s ease;
}

.tip-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.tip-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
