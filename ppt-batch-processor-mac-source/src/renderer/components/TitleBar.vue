<template>
  <div class="title-bar">
    <div class="title-bar-drag-region">
      <div class="title-bar-left">
        <img src="/icon.svg" alt="Logo" class="app-icon" />
        <div class="app-title">{{ t('titleBar.appTitle') }}</div>
        <div class="brand-badge">
          <span class="brand-text">{{ t('titleBar.brandName') }}</span>
        </div>
      </div>

      <div class="title-bar-right">
        <!-- 广告位 -->
        <div v-if="advInfo" class="adv-container" @click="handleAdvClick">
          <img :src="advInfo.adv_url" class="adv-image" :alt="t('titleBar.advertisement')" />
        </div>

        <el-dropdown trigger="click" @command="changeLanguage">
          <button type="button" class="locale-switch" :title="t('app.language.label')">
            <span class="locale-switch-label">{{ currentLanguageLabel }}</span>
            <el-icon class="locale-switch-icon"><ArrowDown /></el-icon>
          </button>

          <template #dropdown>
            <el-dropdown-menu class="locale-dropdown-menu">
              <el-dropdown-item
                v-for="language in languageOptions"
                :key="language.code"
                :command="language.code"
                :class="{ 'is-active': language.code === currentLocaleOptionCode }"
              >
                <div class="locale-menu-item">
                  <span class="locale-menu-native">{{ language.nativeLabel }}</span>
                  <span class="locale-menu-code">{{ language.shortLabel }}</span>
                </div>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-button
          class="login-button"
          :class="{ 'logged-in': isLoggedIn }"
          @click="handleLogin"
          :type="isLoggedIn ? 'success' : 'primary'"
          plain
          round
        >
          <template #icon>
            <el-icon v-if="isLoggedIn && userInfo?.avatar">
              <img :src="userInfo.avatar" class="user-avatar" :alt="t('titleBar.avatar')" />
            </el-icon>
            <el-icon v-else-if="isLoggedIn">
              <CircleCheck />
            </el-icon>
            <el-icon v-else>
              <User />
            </el-icon>
          </template>
          <span class="user-name">{{
            isLoggedIn && userInfo?.nickname
              ? userInfo.nickname
              : isLoggedIn
                ? t('titleBar.loggedIn')
                : t('titleBar.login')
          }}</span>
        </el-button>

        <div class="window-controls">
          <button
            class="window-control minimize"
            @click="minimizeWindow"
            :title="t('titleBar.minimize')"
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="0" y="5" width="12" height="2" fill="currentColor" />
            </svg>
          </button>

          <button
            class="window-control maximize"
            @click="maximizeWindow"
            :title="t('titleBar.maximize')"
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect
                x="1"
                y="1"
                width="10"
                height="10"
                stroke="currentColor"
                stroke-width="1.5"
                fill="none"
              />
            </svg>
          </button>

          <button class="window-control close" @click="closeWindow" :title="t('common.close')">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" stroke-width="1.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import { User, CircleCheck, ArrowDown } from '@element-plus/icons-vue'
import { getAvailableLocales, useI18n } from '../i18n'
import { translateMessage } from '../utils/translate-message'
import { useAppStore } from '../store/app'

const store = useAppStore()
const { t, locale, setLocale } = useI18n()

type SupportedLanguage = {
  code: string
  shortLabel: string
  nativeLabel: string
}

const languageCatalog: SupportedLanguage[] = [
  { code: 'ar', shortLabel: 'AR', nativeLabel: 'العربية' },
  { code: 'bn', shortLabel: 'BN', nativeLabel: 'বাংলা' },
  { code: 'de', shortLabel: 'DE', nativeLabel: 'Deutsch' },
  { code: 'en', shortLabel: 'EN', nativeLabel: 'English' },
  { code: 'es', shortLabel: 'ES', nativeLabel: 'Español' },
  { code: 'fa', shortLabel: 'FA', nativeLabel: 'فارسی' },
  { code: 'fr', shortLabel: 'FR', nativeLabel: 'Français' },
  { code: 'he', shortLabel: 'HE', nativeLabel: 'עברית' },
  { code: 'hi', shortLabel: 'HI', nativeLabel: 'हिन्दी' },
  { code: 'id', shortLabel: 'ID', nativeLabel: 'Bahasa Indonesia' },
  { code: 'it', shortLabel: 'IT', nativeLabel: 'Italiano' },
  { code: 'ja', shortLabel: 'JA', nativeLabel: '日本語' },
  { code: 'ko', shortLabel: 'KO', nativeLabel: '한국어' },
  { code: 'ms', shortLabel: 'MS', nativeLabel: 'Bahasa Melayu' },
  { code: 'nl', shortLabel: 'NL', nativeLabel: 'Nederlands' },
  { code: 'pl', shortLabel: 'PL', nativeLabel: 'Polski' },
  { code: 'pt', shortLabel: 'PT', nativeLabel: 'Português' },
  { code: 'pt_BR', shortLabel: 'PT-BR', nativeLabel: 'Português (Brasil)' },
  { code: 'ru', shortLabel: 'RU', nativeLabel: 'Русский' },
  { code: 'sw', shortLabel: 'SW', nativeLabel: 'Kiswahili' },
  { code: 'ta', shortLabel: 'TA', nativeLabel: 'தமிழ்' },
  { code: 'th', shortLabel: 'TH', nativeLabel: 'ไทย' },
  { code: 'tl', shortLabel: 'TL', nativeLabel: 'Filipino' },
  { code: 'tr', shortLabel: 'TR', nativeLabel: 'Türkçe' },
  { code: 'uk', shortLabel: 'UK', nativeLabel: 'Українська' },
  { code: 'ur', shortLabel: 'UR', nativeLabel: 'اردو' },
  { code: 'vi', shortLabel: 'VI', nativeLabel: 'Tiếng Việt' },
  { code: 'zh_CN', shortLabel: '简中', nativeLabel: '简体中文' },
  { code: 'zh_TW', shortLabel: '繁中', nativeLabel: '繁體中文' },
]

const localeAliases: Record<string, string> = {
  zh: 'zh_CN',
  en: 'en',
}

const languageOptions = computed<SupportedLanguage[]>(() => {
  const available = new Set(getAvailableLocales().map((code) => localeAliases[code] || code))

  return languageCatalog.filter((language) => available.has(language.code))
})

const currentLocale = computed(() => locale.value)
const currentLocaleOptionCode = computed(
  () => localeAliases[currentLocale.value] || currentLocale.value
)
const currentLanguageLabel = computed(() => {
  const matched = languageOptions.value.find(
    (language) => language.code === currentLocaleOptionCode.value
  )
  return matched?.nativeLabel || currentLocale.value
})

function translateRendererMessage(
  message?: string,
  messageKey?: string,
  messageParams?: Record<string, string | number>
) {
  return translateMessage(message, messageKey, messageParams)
}

function changeLanguage(nextLocale: string) {
  if (currentLocaleOptionCode.value === nextLocale) return

  const resolvedLocale = setLocale(nextLocale)
  store.updateSettings({ language: resolvedLocale })
}

// 登录状态
const isLoggedIn = ref(false)
const loginToken = ref<string>('')
const userInfo = ref<{ avatar: string; nickname: string } | null>(null)
let checkLoginTimer: number | null = null

// 广告状态
const advInfo = ref<{ adv_url: string; target_url: string; width: number; height: number } | null>(
  null
)

// 更新状态
const updateInfo = ref<{
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string
  updateUrl: string
  updateNotes: string
  forceUpdate: boolean
} | null>(null)

// 从 localStorage 加载登录状态和用户信息
onMounted(() => {
  const savedToken = localStorage.getItem('auth_token')
  const savedUserInfo = localStorage.getItem('user_info')

  // 只加载已保存的用户信息，不自动开始轮询
  if (savedToken && savedUserInfo) {
    try {
      userInfo.value = JSON.parse(savedUserInfo)
      isLoggedIn.value = true
      console.log('已加载保存的用户信息')
    } catch (error) {
      console.error('解析用户信息失败:', error)
    }
  }

  // 监听登录成功事件（来自回调服务器）
  console.log('🔧 正在设置登录成功事件监听器...')
  console.log('window.electronAPI:', window.electronAPI)
  console.log('window.electronAPI 的所有方法:', Object.keys(window.electronAPI || {}))
  console.log('window.electronAPI.onLoginSuccess:', window.electronAPI?.onLoginSuccess)
  console.log('onLoginSuccess 类型:', typeof window.electronAPI?.onLoginSuccess)

  // 定义处理登录成功的函数
  const handleLoginSuccess = async (data: any) => {
    console.log('=== 🎉 收到登录成功通知！ ===')
    console.log('接收到的数据:', data)
    console.log('数据类型:', typeof data)

    // 兼容两种格式：字符串 token 或 对象 {token, userInfo}
    let token: string
    let receivedUserInfo: any = null

    if (typeof data === 'string') {
      // 旧格式：直接是 token 字符串
      token = data
      console.log('收到 token（字符串格式）:', token)
    } else if (data && typeof data === 'object') {
      // 新格式：对象包含 token 和可能的 userInfo
      token = data.token
      receivedUserInfo = data.userInfo
      console.log('收到 token:', token)
      console.log('收到用户信息:', receivedUserInfo)
    } else {
      console.error('❌ 无效的数据格式')
      return
    }

    // 停止轮询
    if (checkLoginTimer) {
      clearInterval(checkLoginTimer)
      checkLoginTimer = null
      console.log('✅ 已停止登录状态轮询')
    }

    // 保存 token
    loginToken.value = token
    localStorage.setItem('auth_token', token)
    console.log('✅ Token 已保存到 localStorage')

    // 如果后端已经获取了用户信息，直接使用
    if (receivedUserInfo) {
      console.log('✅ 使用后端获取的用户信息')
      userInfo.value = receivedUserInfo
      localStorage.setItem('user_info', JSON.stringify(receivedUserInfo))
      isLoggedIn.value = true
      console.log('✅ 登录状态已更新为 true')
      console.log('✅ 头像:', receivedUserInfo.avatar)
      console.log('✅ 昵称:', receivedUserInfo.nickname)
      console.log('✅ 登录成功，用户信息已显示')
    } else {
      // 如果没有用户信息，前端自己获取
      console.log('📞 后端未提供用户信息，前端自己获取...')
      await getUserInfo(token)
      console.log('📞 getUserInfo 调用完成')
      console.log('userInfo.value:', userInfo.value)

      if (userInfo.value) {
        isLoggedIn.value = true
        console.log('✅ 登录状态已更新为 true')
        console.log('✅ 登录成功，用户信息已显示')
      } else {
        console.error('❌ 获取用户信息失败，userInfo 为空')
      }
    }
  }

  if (window.electronAPI && window.electronAPI.onLoginSuccess) {
    console.log('✅ 使用 onLoginSuccess 方法监听事件')
    try {
      window.electronAPI.onLoginSuccess(handleLoginSuccess)
      console.log('✅ 事件监听器已设置')
    } catch (error) {
      console.error('❌ 设置事件监听器失败:', error)
    }
  } else {
    console.error('❌ window.electronAPI.onLoginSuccess 不存在')
    console.log('尝试使用备用方案：直接监听 window 事件...')
  }

  // 备用方案：直接在 window 上监听事件
  // 这是为了绕过 preload 脚本可能的问题
  const handleIpcMessage = (event: any) => {
    console.log('🔔 收到 window 消息事件:', event)
    if (event.detail && event.detail.channel === 'login-success') {
      console.log('✅ 这是 login-success 事件！')
      handleLoginSuccess(event.detail.data)
    }
  }

  window.addEventListener('ipc-message', handleIpcMessage)
  console.log('✅ 已添加 window 级别的事件监听器作为备用')

  // 测试函数：手动触发登录成功（仅用于调试）
  ;(window as any).testLogin = () => {
    console.log('🧪 测试：手动触发登录成功')
    handleLoginSuccess({
      token: 'test-token-123',
      userInfo: {
        avatar:
          'https://image.kunqiongai.com/avatar/20260129/ad6cde2a40f282250133f3119021598c.jpeg',
        nickname: 'Lethehon',
      },
    })
  }
  console.log('💡 提示：可以在控制台运行 window.testLogin() 来测试登录显示')

  // 获取广告
  getAdv()

  // 检查软件更新
  checkForUpdates()
})

// 检查软件更新
const checkForUpdates = async () => {
  console.log('=== checkForUpdates 被调用 ===')
  console.log('window.electronAPI:', window.electronAPI)
  console.log('window.electronAPI.checkUpdate:', window.electronAPI?.checkUpdate)

  try {
    console.log('调用 check-update 接口...')
    const result = await window.electronAPI.checkUpdate()
    console.log('check-update 返回结果:', result)

    if (result.success && result.hasUpdate) {
      updateInfo.value = {
        hasUpdate: result.hasUpdate,
        currentVersion: result.currentVersion || '0.0.1',
        latestVersion: result.latestVersion || '',
        updateUrl: result.updateUrl || '',
        updateNotes: result.updateNotes || '',
        forceUpdate: result.forceUpdate || false,
      }
      console.log('发现新版本:', updateInfo.value)

      // 显示更新提示
      showUpdateDialog()
    } else {
      console.log('已是最新版本或检查失败')
    }
  } catch (error) {
    console.error('检查更新失败:', error)
  }
}

// 显示更新对话框
const showUpdateDialog = async () => {
  if (!updateInfo.value) return

  const { latestVersion, updateNotes, forceUpdate } = updateInfo.value

  try {
    const message = [
      t('titleBar.updateFound', { version: latestVersion }),
      '',
      t('titleBar.updateNotes'),
      updateNotes || t('titleBar.updateDefaultNotes'),
      '',
      t('titleBar.updatePrompt'),
    ].join('\n')

    const options = {
      confirmButtonText: t('titleBar.updateNow'),
      cancelButtonText: forceUpdate ? t('titleBar.notNow') : t('titleBar.remindLater'),
      type: (forceUpdate ? 'warning' : 'info') as 'warning' | 'info',
      showCloseButton: !forceUpdate,
      closeOnClickModal: !forceUpdate,
      closeOnPressEscape: !forceUpdate,
    }

    await ElMessageBox.confirm(message, t('titleBar.softwareUpdate'), options)

    // 用户确认更新，打开更新链接
    if (updateInfo.value.updateUrl) {
      await window.electronAPI.openExternal(updateInfo.value.updateUrl)
    }
  } catch (error) {
    // 用户取消更新
    if (!forceUpdate) {
      console.log('用户取消更新')
    }
  }
}

// 获取广告
const getAdv = async () => {
  console.log('=== getAdv 被调用 ===')
  console.log('window.electronAPI:', window.electronAPI)
  console.log('window.electronAPI.invoke:', window.electronAPI?.invoke)

  try {
    console.log('调用 get-adv 接口...')
    const result = await window.electronAPI.invoke('get-adv')
    console.log('get-adv 返回结果:', result)

    if (result.success && result.adv) {
      advInfo.value = result.adv
      console.log('广告信息已设置:', result.adv)
    } else {
      console.log('获取广告失败或无广告:', result)
    }
  } catch (error) {
    console.error('获取广告失败:', error)
  }
}

// 点击广告
const handleAdvClick = async () => {
  console.log('=== handleAdvClick 被调用 ===')
  console.log('advInfo:', advInfo.value)

  if (advInfo.value && advInfo.value.target_url) {
    console.log('打开广告链接:', advInfo.value.target_url)
    try {
      await window.electronAPI.invoke('open-external', advInfo.value.target_url)
      console.log('✅ 广告链接已在浏览器中打开')
    } catch (error) {
      console.error('❌ 打开广告链接失败:', error)
    }
  } else {
    console.log('广告信息不完整，无法跳转')
  }
}

// 清理定时器和监听器
onUnmounted(() => {
  if (checkLoginTimer) {
    clearInterval(checkLoginTimer)
  }
  if (window.electronAPI.removeLoginSuccessListener) {
    window.electronAPI.removeLoginSuccessListener()
  }
})

// 获取用户信息
const getUserInfo = async (token: string) => {
  console.log('=== getUserInfo 被调用 ===')
  console.log('Token:', token)
  console.log('Token 类型:', typeof token)

  try {
    console.log('📡 调用 get-user-info 接口...')
    const result = await window.electronAPI.invoke('get-user-info', token)
    console.log('📡 get-user-info 返回结果:', result)
    console.log('result.success:', result.success)
    console.log('result.userInfo:', result.userInfo)

    if (result.success && result.userInfo) {
      userInfo.value = result.userInfo
      // 保存用户信息到 localStorage
      localStorage.setItem('user_info', JSON.stringify(result.userInfo))
      console.log('✅ 用户信息已设置:', result.userInfo)
      console.log('✅ 头像:', result.userInfo.avatar)
      console.log('✅ 昵称:', result.userInfo.nickname)
    } else {
      console.error('❌ 获取用户信息失败:', result.error || '未知错误')
      console.error('完整响应:', JSON.stringify(result))
    }
  } catch (error) {
    console.error('❌ 获取用户信息异常:', error)
    console.error('错误详情:', error instanceof Error ? error.message : String(error))
  }
}

// 检查登录状态
const checkLoginStatus = async (token: string) => {
  console.log('=== checkLoginStatus 被调用 ===')
  console.log('Token:', token)

  try {
    console.log('调用 check-login 接口...')
    const result = await window.electronAPI.invoke('check-login', token)
    console.log('check-login 返回结果:', result)

    if (result.success && result.isLoggedIn) {
      isLoggedIn.value = true
      console.log('✅ 用户已登录:', result.message)

      // 如果返回了 token，使用它来获取用户信息
      if (result.token) {
        console.log('收到 token:', result.token)
        // 保存真正的 token
        localStorage.setItem('auth_token', result.token)

        // 获取用户信息
        console.log('当前 userInfo.value:', userInfo.value)
        if (!userInfo.value) {
          console.log('开始获取用户信息...')
          await getUserInfo(result.token)
        } else {
          console.log('用户信息已存在，跳过获取')
        }
      } else {
        console.log('⚠️ 未收到 token，无法获取用户信息')
      }

      // 停止轮询
      if (checkLoginTimer) {
        clearInterval(checkLoginTimer)
        checkLoginTimer = null
        console.log('✅ 已停止登录状态轮询')
      }
    } else {
      isLoggedIn.value = false
      console.log('❌ 用户未登录或登录同步失败')
      console.log('完整响应:', result)
      if (result.error) {
        console.error('错误信息:', result.error)
      }
      // 如果是参数错误，可能是 API 限制导致的
      if (result.message && result.message.includes('参数错误')) {
        console.log('⚠️ 提示：这可能是 API 限制导致的，登录可能已成功但无法自动同步')
      }
    }
  } catch (error) {
    console.error('❌ 检查登录状态失败:', error)
  }
}

// 开始轮询检查登录状态
const startCheckingLogin = (token: string) => {
  console.log('开始轮询检查登录状态')
  console.log('client_nonce:', token)

  // 延迟 5 秒后开始第一次检查，给用户时间在浏览器中登录
  setTimeout(() => {
    console.log('开始第一次登录检查...')
    checkLoginStatus(token)

    // 每 5 秒检查一次
    checkLoginTimer = window.setInterval(() => {
      checkLoginStatus(token)
    }, 5000)

    // 60 秒后停止轮询
    setTimeout(() => {
      if (checkLoginTimer) {
        clearInterval(checkLoginTimer)
        checkLoginTimer = null
        console.log('登录检查超时，已停止轮询')
      }
    }, 60000)
  }, 5000)
}

// 处理登录
const handleLogin = async () => {
  console.log('=== handleLogin 被调用 ===')
  console.log('window.electronAPI:', window.electronAPI)
  console.log('window.electronAPI.invoke:', window.electronAPI?.invoke)

  if (isLoggedIn.value) {
    // 已登录，显示退出登录确认对话框
    try {
      await ElMessageBox.confirm(t('titleBar.logoutPrompt'), t('titleBar.logoutTitle'), {
        confirmButtonText: t('titleBar.confirmLogout'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
        customClass: 'logout-confirm-dialog',
      })

      // 用户确认退出，清除登录状态和用户信息
      isLoggedIn.value = false
      userInfo.value = null
      loginToken.value = ''
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_info')
      localStorage.removeItem('login_token')
      console.log('✅ 已退出登录')
    } catch {
      // 用户取消退出，不做任何操作
      console.log('用户取消退出登录')
    }
    return
  }

  try {
    console.log('正在获取登录地址...')
    console.log('调用 invoke 方法...')

    const result = await window.electronAPI.invoke('get-login-url')
    console.log('invoke 返回结果:', result)

    if (result.success && result.loginUrl) {
      console.log('登录地址:', result.loginUrl)

      // 生成 client_nonce（客户端临时会话ID）
      const clientNonce = result.token || generateToken()
      loginToken.value = clientNonce

      // 保存 client_nonce 到 localStorage
      localStorage.setItem('login_token', clientNonce)

      // 直接使用返回的登录 URL，不添加参数
      console.log('登录 URL:', result.loginUrl)
      console.log('client_nonce:', clientNonce)

      // 在默认浏览器中打开登录地址
      const openResult = await window.electronAPI.invoke('open-external', result.loginUrl)
      if (!openResult?.success) {
        throw new Error(openResult?.error || 'Failed to open login URL')
      }
      console.log('✅ 登录页面已在浏览器中打开')
      console.log('client_nonce:', clientNonce)

      // 不再需要轮询，使用回调机制
      // startCheckingLogin(clientNonce)

      console.log('已打开登录页面，请在浏览器中完成登录...')
      console.log('登录成功后，浏览器会自动跳转并同步登录状态')
    } else {
      console.error('获取登录地址失败:', result.error)
      const translatedError =
        translateRendererMessage(result.error, result.errorKey, result.errorParams) ||
        t('common.unknownError')
      alert(
        result.errorKey ? translatedError : t('titleBar.loginUrlFailed', { error: translatedError })
      )
    }
  } catch (error) {
    console.error('登录失败:', error)
    alert(t('titleBar.loginFailedRetry'))
  }
}

// 生成 UUID token
const generateToken = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const minimizeWindow = async () => {
  const result = await window.electronAPI.invoke('window-minimize')
  if (result && result.success === false) {
    console.warn('窗口最小化失败：未找到活动窗口')
  }
}

const maximizeWindow = async () => {
  const result = await window.electronAPI.invoke('window-maximize')
  if (result && result.success === false) {
    console.warn('窗口最大化失败：未找到活动窗口')
  }
}

const closeWindow = async () => {
  const result = await window.electronAPI.invoke('window-close')
  if (result && result.success === false) {
    console.warn('窗口关闭失败：未找到活动窗口')
  }
}
</script>

<style scoped>
.title-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.title-bar-drag-region {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 16px;
  -webkit-app-region: drag;
  user-select: none;
}

.title-bar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.app-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.brand-badge {
  display: flex;
  align-items: center;
  padding: 2px 10px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  margin-left: 8px;
  backdrop-filter: blur(4px);
}

.brand-text {
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.title-bar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  -webkit-app-region: no-drag;
}

.locale-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(4px);
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.locale-switch:hover {
  background: rgba(255, 255, 255, 0.2);
}

.locale-switch-label {
  max-width: 92px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 700;
}

.locale-switch-icon {
  font-size: 12px;
  opacity: 0.9;
}

.locale-dropdown-menu {
  max-height: 360px;
  overflow-y: auto;
}

.locale-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 180px;
}

.locale-menu-native {
  color: #1f2937;
}

.locale-menu-code {
  color: #6b7280;
  font-size: 12px;
  font-weight: 700;
}

.locale-dropdown-menu :deep(.el-dropdown-menu__item.is-active) {
  background: #eef2ff;
}

.locale-dropdown-menu :deep(.el-dropdown-menu__item.is-active .locale-menu-native) {
  color: #4338ca;
  font-weight: 700;
}

.locale-switch,
.locale-switch:focus,
.locale-switch:focus-visible {
  border: none;
  outline: none;
}

.login-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 20px;
  transition: all 0.3s ease;
  -webkit-app-region: no-drag;
}

.login-button :deep(.el-icon) {
  font-size: 16px;
}

.login-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.login-button.logged-in {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.9), rgba(69, 160, 73, 0.9));
  border-color: transparent;
  color: white;
}

.login-button.logged-in:hover {
  background: linear-gradient(135deg, rgba(76, 175, 80, 1), rgba(69, 160, 73, 1));
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.login-button:not(.logged-in) {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7));
  border-color: rgba(255, 255, 255, 0.5);
  color: #667eea;
}

.login-button:not(.logged-in):hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0.9));
  border-color: rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.user-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.5);
  vertical-align: middle;
}

.user-name {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.adv-container {
  height: 32px;
  margin-right: 12px;
  cursor: pointer;
  border-radius: 4px;
  overflow: hidden;
  transition: all 0.2s;
  -webkit-app-region: no-drag;
}

.adv-container:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.adv-image {
  height: 100%;
  width: auto;
  display: block;
  object-fit: contain;
}

.window-controls {
  display: flex;
  align-items: center;
  gap: 1px;
  margin-left: 8px;
  -webkit-app-region: no-drag;
}

.window-control {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 40px;
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  transition: background-color 0.2s;
  -webkit-app-region: no-drag;
}

.window-control:hover {
  background: rgba(255, 255, 255, 0.1);
}

.window-control:active {
  background: rgba(255, 255, 255, 0.2);
}

.window-control.close:hover {
  background: #e81123;
}

.window-control.close:active {
  background: #c50f1f;
}

.window-control svg {
  opacity: 0.9;
}

.window-control:hover svg {
  opacity: 1;
}
</style>
