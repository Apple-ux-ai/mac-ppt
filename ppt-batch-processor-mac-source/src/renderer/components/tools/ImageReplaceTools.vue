<template>
  <div class="image-replace-tools">
    <el-card class="tool-card">
      <template #header>
        <div class="card-header">
          <span>{{ t('图片替换规则') }}</span>
          <el-button type="primary" size="small" @click="addRule">
            <el-icon><Plus /></el-icon>
            {{ t('添加规则') }}
          </el-button>
        </div>
      </template>

      <div v-if="rules.length === 0" class="empty-state">
        <el-empty :description="t('暂无替换规则，点击上方按钮添加')" />
      </div>

      <div v-else class="rules-list">
        <el-card v-for="(rule, index) in rules" :key="index" class="rule-card" shadow="hover">
          <div class="rule-content">
            <div class="rule-row">
              <el-form-item :label="t('匹配方式')">
                <el-select v-model="rule.matchType" :placeholder="t('请选择匹配方式')">
                  <el-option :label="t('替换所有图片')" value="all" />
                  <el-option :label="t('按图片名称')" value="name" />
                  <el-option :label="t('按图片索引')" value="index" />
                </el-select>
              </el-form-item>

              <el-form-item v-if="rule.matchType === 'name'" :label="t('图片名称')">
                <el-input
                  v-model="rule.matchValue"
                  :placeholder="t('输入图片名称（支持部分匹配）')"
                />
              </el-form-item>

              <el-form-item v-if="rule.matchType === 'index'" :label="t('图片索引')">
                <el-input-number
                  v-model="rule.matchValue"
                  :min="0"
                  :placeholder="t('输入图片索引（从0开始）')"
                />
              </el-form-item>
            </div>

            <div class="rule-row">
              <el-form-item :label="t('新图片')">
                <div class="file-input-group">
                  <el-input
                    v-model="rule.newImagePath"
                    :placeholder="t('选择新图片文件')"
                    readonly
                  />
                  <el-button @click="selectImage(index)">
                    <el-icon><FolderOpened /></el-icon>
                    {{ t('选择图片') }}
                  </el-button>
                </div>
              </el-form-item>
            </div>

            <div class="rule-row">
              <el-form-item :label="t('保持原尺寸')">
                <el-switch v-model="rule.keepOriginalSize" />
              </el-form-item>

              <el-button type="danger" size="small" @click="removeRule(index)">
                <el-icon><Delete /></el-icon>
                {{ t('删除规则') }}
              </el-button>
            </div>
          </div>
        </el-card>
      </div>
    </el-card>

    <el-card class="preview-card" v-if="previewImages.length > 0">
      <template #header>
        <span>{{ t('当前文件中的图片') }}</span>
      </template>
      <div class="preview-list">
        <div v-for="(img, index) in previewImages" :key="index" class="preview-item">
          <div class="preview-info">
            <div class="preview-index">{{ t('索引:') }} {{ index }}</div>
            <div class="preview-name">{{ img.name }}</div>
            <div class="preview-size">{{ img.width }} × {{ img.height }}</div>
            <div class="preview-slide">
              {{ t('幻灯片 {index}', { index: img.slideIndex + 1 }) }}
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Plus, FolderOpened, Delete } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useI18n } from '../../i18n'

interface ImageReplaceRule {
  matchType: 'name' | 'index' | 'all'
  matchValue?: string | number
  newImagePath: string
  keepOriginalSize: boolean
}

interface PreviewImage {
  slideIndex: number
  elementIndex: number
  name: string
  width: number
  height: number
}

const props = defineProps<{
  inputFiles: string[]
}>()

const emit = defineEmits<{
  (e: 'update:rules', rules: ImageReplaceRule[]): void
}>()

const { t } = useI18n()

const rules = ref<ImageReplaceRule[]>([])
const previewImages = ref<PreviewImage[]>([])

// 添加规则
const addRule = () => {
  rules.value.push({
    matchType: 'all',
    newImagePath: '',
    keepOriginalSize: true,
  })
  emit('update:rules', rules.value)
}

// 删除规则
const removeRule = (index: number) => {
  rules.value.splice(index, 1)
  emit('update:rules', rules.value)
}

// 选择图片
const selectImage = async (index: number) => {
  try {
    const result = await window.electronAPI.selectImageFile()
    if (result) {
      rules.value[index].newImagePath = result
      emit('update:rules', rules.value)
    }
  } catch (error) {
    ElMessage.error(t('选择图片失败'))
  }
}

// 加载图片预览
const loadPreview = async () => {
  if (props.inputFiles.length === 0) {
    previewImages.value = []
    return
  }

  try {
    const firstFile = props.inputFiles[0]
    const images = await window.electronAPI.getImageList(firstFile)
    previewImages.value = images
  } catch (error) {
    console.error('加载图片预览失败:', error)
  }
}

// 监听输入文件变化
watch(() => props.inputFiles, loadPreview, { immediate: true })

// 监听规则变化
watch(
  rules,
  () => {
    emit('update:rules', rules.value)
  },
  { deep: true }
)
</script>

<style scoped>
.image-replace-tools {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tool-card {
  flex: 1;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.empty-state {
  padding: 40px 0;
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rule-card {
  border: 1px solid #e4e7ed;
}

.rule-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rule-row {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.rule-row .el-form-item {
  margin-bottom: 0;
  flex: 1;
  min-width: 200px;
}

.file-input-group {
  display: flex;
  gap: 8px;
  width: 100%;
}

.file-input-group .el-input {
  flex: 1;
}

.preview-card {
  max-height: 400px;
  overflow-y: auto;
}

.preview-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.preview-item {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 12px;
  background: #f5f7fa;
}

.preview-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.preview-index {
  font-weight: bold;
  color: #409eff;
}

.preview-name {
  color: #303133;
  word-break: break-all;
}

.preview-size,
.preview-slide {
  color: #909399;
}
</style>
