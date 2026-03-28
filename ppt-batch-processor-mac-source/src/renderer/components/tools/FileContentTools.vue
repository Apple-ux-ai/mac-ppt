<template>
  <BaseToolComponent
    :title="t('文件内容处理')"
    :files="props.files"
    :loading="loading"
    :disabled="!props.files || props.files.length === 0"
    :execute-text="t('开始处理')"
    :show-progress="processing"
    :progress="progress"
    :progress-status="progressStatus"
    :progress-text="progressText"
    :results="results"
    :onRemoveFile="props.onRemoveFile"
    @execute="handleProcess"
    @reset="handleReset"
    @download="downloadFile"
    @download-all="downloadAll"
  >
    <template #config>
      <el-form :model="form" label-width="100px" label-position="left" class="config-form">
        <!-- 操作类型 -->
        <el-form-item :label="t('操作类型')" required>
          <el-radio-group v-model="form.operationType">
            <el-radio-button value="replace">{{ t('替换内容') }}</el-radio-button>
            <el-radio-button value="delete">{{ t('删除内容') }}</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <!-- 查找内容 -->
        <el-form-item :label="t('查找内容')" required>
          <el-input v-model="form.searchText" :placeholder="t('输入要查找的文本')" clearable />
          <div class="form-tip">
            <el-icon><InfoFilled /></el-icon>
            <span>{{ t('支持精确匹配，区分大小写') }}</span>
          </div>
        </el-form-item>

        <!-- 替换内容（仅在替换模式下显示） -->
        <el-form-item v-if="form.operationType === 'replace'" :label="t('替换为')" required>
          <el-input v-model="form.replaceText" :placeholder="t('输入替换后的文本')" clearable />
        </el-form-item>

        <!-- 高级选项 -->
        <el-divider content-position="left">{{ t('高级选项') }}</el-divider>
        <el-space direction="vertical">
          <el-checkbox v-model="form.caseSensitive">{{ t('区分大小写') }}</el-checkbox>
          <el-checkbox v-model="form.wholeWord">{{ t('全字匹配') }}</el-checkbox>
          <el-checkbox v-model="form.useRegex">{{ t('使用正则表达式') }}</el-checkbox>
        </el-space>
      </el-form>
    </template>
  </BaseToolComponent>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'
import BaseToolComponent from '../BaseToolComponent.vue'
import { useI18n } from '../../i18n'

interface LocalFileInfo {
  name: string
  size?: number
  path?: string
}

const props = defineProps<{
  files?: LocalFileInfo[]
  onRemoveFile?: (index: number) => void
}>()

const emit = defineEmits(['update-files'])
const { t } = useI18n()

const form = reactive({
  operationType: 'replace',
  searchText: '',
  replaceText: '',
  caseSensitive: false,
  wholeWord: false,
  useRegex: false,
})

const loading = ref(false)
const processing = ref(false)
const progress = ref(0)
const progressText = ref('')
const progressStatus = ref('')
const results = ref<any[]>([])

const handleProcess = async () => {
  if (!form.searchText) {
    ElMessage.warning(t('请输入要查找的内容'))
    return
  }

  if (form.operationType === 'replace' && !form.replaceText) {
    ElMessage.warning(t('请输入替换后的内容'))
    return
  }

  if (!props.files || props.files.length === 0) {
    ElMessage.warning(t('请先上传文件'))
    return
  }

  loading.value = true
  processing.value = true
  progress.value = 0
  results.value = []
  progressStatus.value = ''

  try {
    const total = props.files.length
    for (let i = 0; i < total; i++) {
      const file = props.files[i] as LocalFileInfo
      progressText.value = t('正在处理: {name} ({current}/{total})', {
        name: file.name,
        current: i + 1,
        total,
      })
      progress.value = Math.round(((i + 1) / total) * 100)

      try {
        // 这里调用 Electron IPC 进行实际处理
        // const result = await window.electronAPI.processFile({
        //   filePath: file.path,
        //   operation: form.operationType,
        //   searchText: form.searchText,
        //   replaceText: form.replaceText,
        //   options: {
        //     caseSensitive: form.caseSensitive,
        //     wholeWord: form.wholeWord,
        //     useRegex: form.useRegex
        //   }
        // })

        // 模拟处理结果
        await new Promise((resolve) => setTimeout(resolve, 500))

        results.value.push({
          fileName: file.name,
          outputName: file.name.replace(/\.(ppt|pptx)$/, '_processed.$1'),
          fileSize: '2.5 MB',
          status: 'success',
          downloadUrl: '#',
        })
      } catch (error: any) {
        results.value.push({
          fileName: file.name,
          outputName: '-',
          fileSize: '-',
          status: 'error',
          error: error.message,
        })
      }
    }

    progressStatus.value = 'success'
    ElMessage.success(t('处理完成！'))
  } catch (error: any) {
    progressStatus.value = 'exception'
    ElMessage.error(t('处理失败：') + error.message)
  } finally {
    loading.value = false
    setTimeout(() => {
      processing.value = false
    }, 1000)
  }
}

const handleReset = () => {
  form.operationType = 'replace'
  form.searchText = ''
  form.replaceText = ''
  form.caseSensitive = false
  form.wholeWord = false
  form.useRegex = false
  results.value = []
  ElMessage.success(t('设置已重置'))
}

const downloadFile = (result: any) => {
  ElMessage.info(t('下载功能开发中...'))
}

const downloadAll = () => {
  const successResults = results.value.filter((r: any) => r.status === 'success')
  if (successResults.length === 0) {
    ElMessage.warning(t('没有可下载的文件'))
    return
  }
  ElMessage.info(t('批量下载功能开发中...'))
}
</script>

<style scoped>
.config-form {
  /* 表单样式 */
}

.form-tip {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  font-size: 13px;
  color: #909399;
}
</style>
