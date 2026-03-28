<template>
  <FeaturePage
    :title="t('根据模板生成文档')"
    :description="t('使用PPT模板和Excel数据源批量生成文档')"
    icon="📄"
    :can-start="canStart"
    :hint="t('请先选择模板文件和数据源')"
    @back="$emit('back')"
    @start="startProcessing"
  >
    <template #config>
      <div class="config-section">
        <div class="info-box">
          <strong>{{ t('模板生成') }}</strong>
          <p>
            {{ t('模板中使用') }} <code v-pre>{{ 字段名 }}</code> {{ t('作为占位符，例如：')
            }}<code v-pre>{{ 姓名 }}</code
            >, <code v-pre>{{ 日期 }}</code>
          </p>
          <p>{{ t('Excel第一行为列名（字段名），每一行数据将生成一个PPT文件') }}</p>
        </div>

        <div class="form-group">
          <label class="form-label required">{{ t('PPT模板文件') }}</label>
          <div class="file-picker">
            <input
              :value="templateFile"
              type="text"
              class="form-input"
              :placeholder="t('选择PPT模板文件')"
              readonly
            />
            <button type="button" class="pick-btn" @click="selectTemplateFile">
              📄 {{ t('选择模板') }}
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label required">{{ t('Excel数据源') }}</label>
          <div class="file-picker">
            <input
              :value="dataSourceFile"
              type="text"
              class="form-input"
              :placeholder="t('选择Excel数据源文件')"
              readonly
            />
            <button type="button" class="pick-btn" @click="selectDataSource">
              📊 {{ t('选择数据源') }}
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('输出文件名模式') }}</label>
          <input
            v-model="outputPattern"
            type="text"
            class="form-input"
            :placeholder="t('例如: {{姓名}}_{{日期}}.pptx')"
          />
          <small class="form-hint"
            >{{ t('使用') }} <code v-pre>{{ 字段名 }}</code>
            {{ t('引用数据，留空则使用序号命名') }}</small
          >
        </div>

        <div class="form-group">
          <label class="form-label required">{{ t('输出目录') }}</label>
          <div class="file-picker">
            <input
              :value="outputDirectory"
              type="text"
              class="form-input"
              :placeholder="t('选择输出目录')"
              readonly
            />
            <button type="button" class="pick-btn" @click="selectOutputDir">
              📁 {{ t('选择目录') }}
            </button>
          </div>
        </div>

        <button type="button" class="download-btn" @click="downloadExample">
          ⬇️ {{ t('下载示例模板和数据') }}
        </button>
      </div>
    </template>

    <template #files>
      <div class="files-placeholder">
        <p>{{ t('此功能不需要选择文件列表') }}</p>
        <p class="hint">{{ t('模板和数据源已在上方配置') }}</p>
      </div>
    </template>

    <template #output>
      <div class="output-placeholder">
        <p>{{ t('输出设置已在上方配置') }}</p>
      </div>
    </template>
  </FeaturePage>
</template>

<script setup lang="ts">
import '../../types/electron.d.ts'
import { ref, computed } from 'vue'
import { useAppStore } from '../../store/app'
import FeaturePage from './FeaturePage.vue'
import { useI18n } from '../../i18n'

const emit = defineEmits<{
  (e: 'back'): void
}>()

const store = useAppStore()
const { t } = useI18n()

const templateFile = ref('')
const dataSourceFile = ref('')
const outputPattern = ref('')
const outputDirectory = ref('')

async function selectTemplateFile() {
  try {
    const result = await window.electronAPI.selectFiles()
    const files = result.files || []
    if (files && files.length > 0) {
      templateFile.value = files[0]
    }
  } catch (error) {
    console.error('选择文件失败:', error)
  }
}

async function selectDataSource() {
  try {
    const path = await window.electronAPI.selectExcelFile()
    if (path) {
      dataSourceFile.value = path
    }
  } catch (error) {
    console.error('选择文件失败:', error)
  }
}

async function selectOutputDir() {
  try {
    const path = await window.electronAPI.selectFolder()
    if (path) {
      outputDirectory.value = path
    }
  } catch (error) {
    console.error('选择目录失败:', error)
  }
}

function downloadExample() {
  const csvContent = t(
    '姓名,部门,日期,金额\n张三,销售部,2024-01-01,10000\n李四,技术部,2024-01-02,15000\n王五,市场部,2024-01-03,12000'
  )

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', t('数据源示例.csv'))
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const canStart = computed(() => {
  return templateFile.value !== '' && dataSourceFile.value !== '' && outputDirectory.value !== ''
})

async function startProcessing() {
  if (!canStart.value) return

  const taskConfig = store.createTaskConfig(
    {
      templatePath: templateFile.value,
      dataSourcePath: dataSourceFile.value,
      outputPattern: outputPattern.value,
    },
    {
      directory: outputDirectory.value,
      overwriteOriginal: false,
      fileNamePattern: outputPattern.value || '{name}',
      createSubfolders: false,
    }
  )
  await store.startProcessing(taskConfig)
}
</script>

<style scoped>
.config-section {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-box {
  padding: 16px;
  background: #f0f4ff;
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  font-size: 13px;
  color: #3730a3;
}

.info-box p {
  margin: 4px 0;
}

.info-box code {
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.form-label.required::after {
  content: ' *';
  color: #ef4444;
}

.form-input {
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  background: #f9fafb;
}

.form-hint {
  font-size: 12px;
  color: #9ca3af;
}

.file-picker {
  display: flex;
  gap: 10px;
}

.file-picker .form-input {
  flex: 1;
}

.pick-btn {
  padding: 10px 16px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.pick-btn:hover {
  background: #e5e7eb;
}

.download-btn {
  padding: 12px 20px;
  background: linear-gradient(135deg, #f0f4ff 0%, #e8ecff 100%);
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  font-size: 14px;
  color: #667eea;
  cursor: pointer;
  transition: all 0.2s ease;
}

.download-btn:hover {
  background: linear-gradient(135deg, #e0e7ff 0%, #d1d5ff 100%);
}

.files-placeholder,
.output-placeholder {
  padding: 40px 20px;
  text-align: center;
  color: #9ca3af;
}

.files-placeholder p,
.output-placeholder p {
  margin: 0;
}

.files-placeholder .hint {
  margin-top: 8px;
  font-size: 13px;
}
</style>
