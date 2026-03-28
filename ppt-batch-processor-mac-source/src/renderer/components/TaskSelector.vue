<template>
  <div class="task-selector">
    <div class="category-item home-item" :class="{ active: store.showHomePage }" @click="goHome">
      <span class="category-icon">🏠</span>
      <span class="category-name">{{ t('category.home') }}</span>
    </div>

    <div class="category-divider"></div>

    <div
      v-for="cat in categories"
      :key="cat.id"
      class="category-item"
      :class="{ active: selectedCategory === cat.id }"
      @click="selectCategory(cat.id)"
    >
      <div
        class="category-icon-wrapper"
        :style="{ backgroundColor: cat.color + '15', color: cat.color }"
      >
        <el-icon :size="18"><component :is="cat.icon" /></el-icon>
      </div>
      <span class="category-name">{{ cat.name }}</span>
      <span class="category-count">{{ cat.count }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAppStore } from '../store/app'
import type { TaskCategory } from '../../shared/types'
import {
  Document,
  Refresh,
  Notebook,
  Stamp,
  Link,
  Files,
  Download,
  Setting,
} from '@element-plus/icons-vue'
import { useI18n } from '../i18n'

const store = useAppStore()
const { t } = useI18n()

interface Category {
  id: TaskCategory
  name: string
  icon: any
  color: string
  count: number
}

const categories: Category[] = [
  { id: 'content', name: t('category.content'), icon: Document, color: '#3b82f6', count: 8 },
  { id: 'conversion', name: t('category.conversion'), icon: Refresh, color: '#10b981', count: 1 },
  {
    id: 'header-footer',
    name: t('category.headerFooter'),
    icon: Notebook,
    color: '#f59e0b',
    count: 1,
  },
  { id: 'watermark', name: t('category.watermark'), icon: Stamp, color: '#8b5cf6', count: 1 },
  { id: 'merge-split', name: t('category.mergeSplit'), icon: Link, color: '#ef4444', count: 2 },
  { id: 'page', name: t('category.page'), icon: Files, color: '#06b6d4', count: 3 },
  { id: 'extraction', name: t('category.extraction'), icon: Download, color: '#6366f1', count: 3 },
  { id: 'properties', name: t('category.properties'), icon: Setting, color: '#ec4899', count: 5 },
]

const selectedCategory = ref<TaskCategory | null>(null)

function selectCategory(category: TaskCategory) {
  selectedCategory.value = category
  store.setTaskCategory(category)
}

function goHome() {
  store.goToHomePage()
  selectedCategory.value = null
}

watch(
  () => store.selectedCategory,
  (newCategory) => {
    if (newCategory) {
      selectedCategory.value = newCategory
    }
  }
)
</script>

<style scoped>
.task-selector {
  display: flex;
  flex-direction: column;
}

.home-item {
  background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%);
}

.home-item:hover {
  background: linear-gradient(135deg, #e0e7ff 0%, #d1d5ff 100%);
}

.home-item.active {
  background: linear-gradient(135deg, #667eea 0%, #7c3aed 100%);
  border-left-color: #7c3aed;
}

.home-item.active .category-name {
  color: white;
  font-weight: 600;
}

.home-item.active .category-icon {
  filter: brightness(1.2);
}

.category-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 8px 16px;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
  position: relative;
}

.category-item:hover {
  background: #f9fafb;
}

.category-item.active {
  background: linear-gradient(90deg, #f0f4ff 0%, #fafbff 100%);
  border-left-color: #667eea;
}

.category-item.active .category-name {
  color: #667eea;
  font-weight: 600;
}

.category-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.category-icon-wrapper {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.category-item:hover .category-icon-wrapper {
  transform: scale(1.05);
}

.category-item.active .category-icon-wrapper {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
}

.category-name {
  font-size: 14px;
  color: #374151;
  transition: all 0.2s ease;
  flex: 1;
}

.category-count {
  font-size: 11px;
  padding: 2px 8px;
  background: #f3f4f6;
  color: #9ca3af;
  border-radius: 10px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.category-item.active .category-count {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.category-item:hover .category-count {
  background: #e5e7eb;
  color: #6b7280;
}
</style>
