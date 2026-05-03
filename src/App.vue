<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-content">
        <h1>Solo Disk Cleaner</h1>
        <p class="subtitle">专业的Windows磁盘清理工具</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-outline btn-sm" @click="toggleSettings">
          设置
        </button>
      </div>
    </header>

    <main class="main-content">
      <div class="error-notification" v-if="errorMessage" @click="errorMessage = ''">
        <div class="error-content">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{{ errorMessage }}</span>
          <button class="error-close" @click.stop="errorMessage = ''">×</button>
        </div>
      </div>

      <section class="drive-selection-section" v-if="!isScanning && !scanComplete">
        <div class="card">
          <div class="card-header">
            <h2>选择要清理的磁盘</h2>
            <button class="btn btn-outline btn-sm" @click="reloadDrives" :disabled="isLoadingDrives">
              <span class="spinner" v-if="isLoadingDrives" style="width: 14px; height: 14px;"></span>
              刷新
            </button>
          </div>
          <div class="card-body">
            <div class="drive-grid" v-if="drives.length > 0">
              <div 
                v-for="drive in drives" 
                :key="drive.letter"
                class="drive-card"
                :class="{ selected: selectedDrive === drive.letter }"
                @click="selectDrive(drive)"
              >
                <div class="drive-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6z"/>
                    <path d="M6 10h12"/>
                    <path d="M9 16h.01"/>
                    <path d="M12 16h.01"/>
                    <path d="M15 16h.01"/>
                  </svg>
                </div>
                <div class="drive-info">
                  <div class="drive-letter">{{ drive.letter }}</div>
                  <div class="drive-name">{{ drive.name }}</div>
                </div>
              </div>
            </div>
            
            <div class="empty-state" v-else>
              <div v-if="isLoadingDrives">
                <div class="spinner" style="width: 40px; height: 40px; margin: 0 auto 16px;"></div>
                <p>正在加载磁盘信息...</p>
                <p class="text-muted" style="font-size: 12px; margin-top: 8px;">
                  如果加载时间过长，请点击刷新按钮
                </p>
              </div>
              <div v-else>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M8 15s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>
                </svg>
                <p>未检测到可用磁盘</p>
                <button class="btn btn-primary btn-sm" style="margin-top: 16px;" @click="reloadDrives">
                  重新检测
                </button>
              </div>
            </div>

            <div class="action-bar" v-if="selectedDrive">
              <button 
                class="btn btn-primary btn-lg" 
                :disabled="isScanning"
                @click="startScan"
              >
                <span class="spinner" v-if="isScanning"></span>
                开始扫描
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="scanning-section" v-if="isScanning">
        <div class="card">
          <div class="card-body p-24">
            <div class="scanning-content">
              <div class="scanning-icon">
                <div class="spinner" style="width: 48px; height: 48px;"></div>
              </div>
              <h3>正在扫描磁盘</h3>
              <p class="text-muted">正在查找可清理的垃圾文件...</p>
              <div class="progress-container">
                <div class="progress-bar">
                  <div class="progress-bar-fill" :style="{ width: scanProgress + '%' }"></div>
                </div>
                <span class="progress-text">{{ scanProgress }}%</span>
              </div>
              <p class="current-scanning text-muted" v-if="currentScanningFile">
                正在扫描: {{ currentScanningFile }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="results-section" v-if="scanComplete && !isDeleting">
        <div class="results-layout">
          <div class="results-sidebar">
            <div class="card">
              <div class="card-header">
                <h3>分类概览</h3>
              </div>
              <div class="card-body p-0">
                <div 
                  v-for="(category, key) in categorizedResults" 
                  :key="key"
                  class="category-item"
                  :class="{ active: selectedCategory === key }"
                  @click="selectCategory(key)"
                >
                  <div class="category-info">
                    <span class="category-name">{{ category.name }}</span>
                    <span class="badge" :class="getCategoryBadgeClass(category)">
                      {{ formatSize(category.totalSize) }}
                    </span>
                  </div>
                  <div class="category-stats">
                    <span class="file-count">{{ category.files.length }} 个文件</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="card mt-16">
              <div class="card-body">
                <div class="summary-box">
                  <div class="summary-item">
                    <span class="summary-label">总文件数</span>
                    <span class="summary-value">{{ totalFiles }}</span>
                  </div>
                  <div class="summary-item">
                    <span class="summary-label">可清理空间</span>
                    <span class="summary-value text-success">{{ formatSize(totalSize) }}</span>
                  </div>
                  <div class="summary-item">
                    <span class="summary-label">已选中</span>
                    <span class="summary-value text-primary">{{ selectedCount }} 个文件</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="results-content">
            <div class="card">
              <div class="card-header">
                <div class="header-left">
                  <div class="checkbox-wrapper">
                    <input 
                      type="checkbox" 
                      :checked="isAllSelected"
                      @change="toggleSelectAll"
                      :disabled="isDeleting"
                    >
                    <span>全选</span>
                  </div>
                  <span class="text-muted ml-auto" v-if="selectedCategory">
                    显示: {{ categorizedResults[selectedCategory]?.name }}
                  </span>
                </div>
                <button 
                  class="btn btn-outline btn-sm"
                  @click="backToSelection"
                  v-if="!isDeleting"
                >
                  重新选择
                </button>
              </div>
              <div class="card-body p-0">
                <div class="file-list">
                  <div 
                    v-for="(file, index) in displayedFiles" 
                    :key="file.path"
                    class="file-item"
                    :class="{ 'has-warning': file.needsConfirmation }"
                  >
                    <div class="file-checkbox">
                      <input 
                        type="checkbox" 
                        :checked="isFileSelected(file)"
                        @change="toggleFileSelection(file)"
                        :disabled="isDeleting || file.needsConfirmation && !canDeleteConfirm(file)"
                      >
                    </div>
                    <div class="file-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14,2 14,8 20,8"/>
                      </svg>
                    </div>
                    <div class="file-info">
                      <div class="file-name">
                        {{ file.name }}
                        <span 
                          class="badge badge-warning" 
                          v-if="file.needsConfirmation"
                          title="需要确认删除"
                        >
                          需确认
                        </span>
                        <span 
                          class="badge badge-info" 
                          v-if="file.aiAnalyzed"
                          title="AI已分析"
                        >
                          AI分析
                        </span>
                      </div>
                      <div class="file-path">{{ file.path }}</div>
                      <div class="file-details text-muted">
                        <span>{{ formatSize(file.size) }}</span>
                        <span>·</span>
                        <span>修改于: {{ formatDate(file.modifiedTime) }}</span>
                      </div>
                    </div>
                    <div class="file-actions">
                      <button 
                        class="btn btn-outline btn-sm"
                        @click="analyzeWithAI(file)"
                        :disabled="isAnalyzingAI === file.path"
                        title="AI识别"
                      >
                        <span class="spinner" v-if="isAnalyzingAI === file.path" style="width: 14px; height: 14px;"></span>
                        AI识别
                      </button>
                    </div>
                  </div>

                  <div class="empty-state" v-if="displayedFiles.length === 0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z"/>
                    </svg>
                    <p>该分类下暂无文件</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="action-bar-bottom">
              <div class="action-info">
                <span v-if="selectedCount > 0" class="text-muted">
                  已选择 <strong>{{ selectedCount }}</strong> 个文件，共 <strong class="text-success">{{ formatSize(selectedSize) }}</strong>
                </span>
                <span v-else class="text-muted">
                  请选择要删除的文件
                </span>
              </div>
              <div class="action-buttons">
                <button 
                  class="btn btn-danger btn-lg"
                  :disabled="selectedCount === 0 || isDeleting"
                  @click="confirmDelete"
                >
                  <span class="spinner" v-if="isDeleting"></span>
                  清理选中
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="deleting-section" v-if="isDeleting">
        <div class="card">
          <div class="card-body p-24">
            <div class="deleting-content">
              <div class="deleting-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </div>
              <h3>正在清理文件</h3>
              <p class="text-muted">请耐心等待，不要关闭应用...</p>
              <div class="progress-container">
                <div class="progress-bar">
                  <div class="progress-bar-fill danger" :style="{ width: deleteProgress + '%' }"></div>
                </div>
                <span class="progress-text">{{ deleteProgress }}%</span>
              </div>
              <p class="current-deleting text-muted" v-if="currentDeletingFile">
                正在删除: {{ currentDeletingFile }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="complete-section" v-if="deleteComplete">
        <div class="card">
          <div class="card-body p-24">
            <div class="complete-content">
              <div class="complete-icon success">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <h3>清理完成！</h3>
              <div class="complete-stats">
                <div class="stat-item">
                  <span class="stat-value">{{ deleteResult.success?.length || 0 }}</span>
                  <span class="stat-label">成功删除</span>
                </div>
                <div class="stat-item" v-if="deleteResult.failed?.length > 0">
                  <span class="stat-value text-warning">{{ deleteResult.failed?.length || 0 }}</span>
                  <span class="stat-label">删除失败</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value text-success">{{ formatSize(deleteResult.totalDeleted || 0) }}</span>
                  <span class="stat-label">释放空间</span>
                </div>
              </div>
              <div class="complete-actions">
                <button class="btn btn-primary" @click="backToSelection">
                  返回首页
                </button>
                <button class="btn btn-outline" @click="viewFailed" v-if="deleteResult.failed?.length > 0">
                  查看失败项
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="ai-modal" v-if="showAIModal">
        <div class="modal-overlay" @click="closeAIModal"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h3>AI文件分析结果</h3>
            <button class="modal-close" @click="closeAIModal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="modal-body" v-if="aiAnalysisResult">
            <div class="ai-file-info">
              <span class="file-name">{{ aiAnalysisFile?.name }}</span>
            </div>
            
            <div class="ai-result">
              <div class="result-item">
                <span class="result-label">安全性评估</span>
                <span class="badge" :class="aiAnalysisResult.safeToDelete === true ? 'badge-success' : (aiAnalysisResult.safeToDelete === false ? 'badge-danger' : 'badge-warning')">
                  {{ aiAnalysisResult.safeToDelete === true ? '可以安全删除' : (aiAnalysisResult.safeToDelete === false ? '不建议删除' : '需要谨慎') }}
                </span>
              </div>
              
              <div class="result-item">
                <span class="result-label">可信度</span>
                <div class="confidence-bar">
                  <div 
                    class="confidence-fill" 
                    :class="getConfidenceClass(aiAnalysisResult.confidence)"
                    :style="{ width: aiAnalysisResult.confidence + '%' }"
                  ></div>
                  <span class="confidence-text">{{ aiAnalysisResult.confidence }}%</span>
                </div>
              </div>
              
              <div class="result-item" v-if="aiAnalysisResult.description">
                <span class="result-label">文件描述</span>
                <span class="result-value">{{ aiAnalysisResult.description }}</span>
              </div>
              
              <div class="result-item" v-if="aiAnalysisResult.impact">
                <span class="result-label">删除影响</span>
                <span class="result-value">{{ aiAnalysisResult.impact }}</span>
              </div>
              
              <div class="result-item warning-item" v-if="aiAnalysisResult.warning">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span class="warning-text">{{ aiAnalysisResult.warning }}</span>
              </div>
              
              <div class="result-item" v-if="aiAnalysisResult.sources?.length > 0">
                <span class="result-label">信息来源</span>
                <span class="result-value">{{ aiAnalysisResult.sources.join(', ') }}</span>
              </div>
            </div>
          </div>
          <div class="modal-loading" v-else>
            <div class="spinner" style="width: 40px; height: 40px;"></div>
            <p>正在通过AI分析文件...</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const IPC_TIMEOUT = 30000

let ipcRenderer = null

try {
  if (window.require) {
    ipcRenderer = window.require('electron').ipcRenderer
    console.log('[Renderer] Electron ipcRenderer available')
  } else {
    console.log('[Renderer] window.require not available, running in non-Electron environment')
  }
} catch (error) {
  console.log('[Renderer] Error accessing Electron:', error)
}

if (!ipcRenderer) {
  ipcRenderer = {
    invoke: async (channel, ...args) => {
      console.log(`[Renderer] Mock IPC invoke: ${channel}`, args)
      
      if (channel === 'ping') {
        return { success: true, timestamp: Date.now() }
      }
      
      if (channel === 'get-drives') {
        return {
          success: true,
          data: [
            { letter: 'C:', name: '系统盘', type: 'Local Disk' },
            { letter: 'D:', name: '数据盘', type: 'Local Disk' }
          ]
        }
      }
      
      if (channel === 'scan-disk') {
        await new Promise(resolve => setTimeout(resolve, 2000))
        return {
          success: true,
          data: {
            SYSTEM_TEMP: {
              name: '系统临时文件',
              description: 'Windows系统产生的临时文件',
              safeToDelete: true,
              defaultChecked: true,
              files: [
                { path: 'C:\\Temp\\temp1.tmp', name: 'temp1.tmp', size: 102400, modifiedTime: '2024-01-15', extension: '.tmp' },
                { path: 'C:\\Temp\\temp2.tmp', name: 'temp2.tmp', size: 204800, modifiedTime: '2024-01-14', extension: '.tmp' }
              ],
              totalSize: 358400
            },
            BROWSER_CACHE: {
              name: '浏览器缓存',
              description: 'Chrome、Edge、Firefox等浏览器的缓存文件',
              safeToDelete: true,
              defaultChecked: true,
              files: [
                { path: 'C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\Cache\\cache1', name: 'cache1', size: 1048576, modifiedTime: '2024-01-15', extension: '' }
              ],
              totalSize: 1048576
            },
            LOG_FILES: {
              name: '系统日志',
              description: 'Windows系统和应用程序的日志文件',
              safeToDelete: true,
              defaultChecked: true,
              files: [
                { path: 'C:\\Windows\\Logs\\CBS\\CBS.log', name: 'CBS.log', size: 204800, modifiedTime: '2024-01-15', extension: '.log' }
              ],
              totalSize: 204800
            }
          }
        }
      }
      
      if (channel === 'search-file-safety') {
        const [fileName, filePath] = args
        const ext = fileName ? fileName.substring(fileName.lastIndexOf('.')) : ''
        
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        if (['.tmp', '.temp', '.log', '.bak', '.old'].includes(ext.toLowerCase())) {
          return {
            success: true,
            data: {
              safeToDelete: true,
              confidence: 95,
              description: '这是一个临时文件或日志文件，由程序自动生成。',
              impact: '删除该文件不会对系统或程序产生负面影响。',
              sources: ['本地知识库']
            }
          }
        }
        
        return {
          success: true,
          data: {
            safeToDelete: null,
            confidence: 50,
            description: '无法确定该文件的具体用途。',
            impact: '不确定删除该文件的影响。建议谨慎操作。',
            warning: '无法确认该文件是否可以安全删除，请谨慎操作。',
            sources: ['本地知识库']
          }
        }
      }
      
      if (channel === 'delete-files') {
        const [files] = args
        await new Promise(resolve => setTimeout(resolve, 1500))
        return {
          success: true,
          data: {
            success: files,
            failed: [],
            totalDeleted: files.reduce((sum, f) => sum + (f.size || 0), 0)
          }
        }
      }
      
      if (channel === 'show-confirm-dialog') {
        return true
      }
      
      return { success: false, error: 'Not in Electron' }
    },
    on: (channel, listener) => {
      console.log(`[Renderer] Mock IPC on: ${channel}`)
    },
    removeListener: (channel, listener) => {
      console.log(`[Renderer] Mock IPC removeListener: ${channel}`)
    }
  }
}

console.log('[Renderer] ipcRenderer setup complete')

const drives = ref([])
const selectedDrive = ref(null)
const isLoadingDrives = ref(false)
const isScanning = ref(false)
const scanProgress = ref(0)
const currentScanningFile = ref('')
const scanComplete = ref(false)
const categorizedResults = ref({})
const selectedCategory = ref(null)
const selectedFiles = ref(new Set())
const isDeleting = ref(false)
const deleteProgress = ref(0)
const currentDeletingFile = ref('')
const deleteComplete = ref(false)
const deleteResult = ref({})
const isAnalyzingAI = ref(null)
const aiAnalysisResult = ref(null)
const aiAnalysisFile = ref(null)
const showAIModal = ref(false)
const errorMessage = ref('')

const electronAvailable = computed(() => {
  return ipcRenderer && typeof ipcRenderer.invoke === 'function'
})

const totalFiles = computed(() => {
  let count = 0
  Object.values(categorizedResults.value).forEach(cat => {
    if (cat.files) {
      count += cat.files.length
    }
  })
  return count
})

const totalSize = computed(() => {
  let size = 0
  Object.values(categorizedResults.value).forEach(cat => {
    size += cat.totalSize || 0
  })
  return size
})

const displayedFiles = computed(() => {
  if (selectedCategory.value && categorizedResults.value[selectedCategory.value]) {
    return categorizedResults.value[selectedCategory.value].files || []
  }
  
  let files = []
  Object.values(categorizedResults.value).forEach(cat => {
    if (cat.files) {
      files = files.concat(cat.files)
    }
  })
  return files
})

const isAllSelected = computed(() => {
  return displayedFiles.value.length > 0 && 
         displayedFiles.value.every(file => selectedFiles.value.has(file.path))
})

const selectedCount = computed(() => selectedFiles.value.size)

const selectedSize = computed(() => {
  let size = 0
  displayedFiles.value.forEach(file => {
    if (selectedFiles.value.has(file.path)) {
      size += file.size || 0
    }
  })
  return size
})

const getCategoryBadgeClass = (category) => {
  if (category.safeToDelete && category.defaultChecked) return 'badge-success'
  if (category.safeToDelete) return 'badge-info'
  return 'badge-warning'
}

const getConfidenceClass = (confidence) => {
  if (confidence >= 80) return 'success'
  if (confidence >= 50) return 'warning'
  return 'danger'
}

const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (dateStr) => {
  if (!dateStr) return '未知'
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN')
}

const showError = (message) => {
  console.error('[Renderer] Error:', message)
  errorMessage.value = message
  setTimeout(() => {
    if (errorMessage.value === message) {
      errorMessage.value = ''
    }
  }, 5000)
}

const invokeWithTimeout = async (channel, ...args) => {
  console.log(`[Renderer] Invoking IPC: ${channel}`, args)
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.log(`[Renderer] IPC timeout: ${channel}`)
      reject(new Error(`操作超时 (${IPC_TIMEOUT / 1000}秒)`))
    }, IPC_TIMEOUT)
    
    ipcRenderer.invoke(channel, ...args)
      .then(result => {
        clearTimeout(timeout)
        console.log(`[Renderer] IPC result: ${channel}`, result)
        resolve(result)
      })
      .catch(error => {
        clearTimeout(timeout)
        console.error(`[Renderer] IPC error: ${channel}`, error)
        reject(error)
      })
  })
}

const loadDrives = async () => {
  console.log('[Renderer] loadDrives called')
  console.log('[Renderer] electronAvailable:', electronAvailable.value)
  
  isLoadingDrives.value = true
  errorMessage.value = ''
  
  try {
    console.log('[Renderer] Calling ipcRenderer.invoke("get-drives")...')
    const result = await invokeWithTimeout('get-drives')
    console.log('[Renderer] get-drives result:', result)
    
    if (result.success && result.data && result.data.length > 0) {
      drives.value = result.data
      console.log('[Renderer] Drives loaded:', drives.value)
    } else {
      console.log('[Renderer] No drives returned, using fallback')
      drives.value = [
        { letter: 'C:', name: '系统盘', type: 'Local Disk' },
        { letter: 'D:', name: '数据盘', type: 'Local Disk' }
      ]
    }
  } catch (error) {
    console.error('[Renderer] Failed to load drives:', error)
    showError('加载磁盘信息失败: ' + error.message)
    
    console.log('[Renderer] Using fallback drives')
    drives.value = [
      { letter: 'C:', name: '系统盘', type: 'Local Disk' },
      { letter: 'D:', name: '数据盘', type: 'Local Disk' }
    ]
  } finally {
    isLoadingDrives.value = false
  }
}

const reloadDrives = async () => {
  console.log('[Renderer] reloadDrives called')
  drives.value = []
  await loadDrives()
}

const selectDrive = (drive) => {
  console.log('[Renderer] selectDrive:', drive)
  selectedDrive.value = selectedDrive.value === drive.letter ? null : drive.letter
}

const startScan = async () => {
  if (!selectedDrive.value) return
  
  console.log('[Renderer] startScan for drive:', selectedDrive.value)
  
  isScanning.value = true
  scanProgress.value = 0
  currentScanningFile.value = ''
  scanComplete.value = false
  errorMessage.value = ''
  
  const progressInterval = setInterval(() => {
    if (scanProgress.value < 90) {
      scanProgress.value += Math.random() * 10
    }
  }, 500)
  
  try {
    console.log('[Renderer] Calling scan-disk IPC...')
    const result = await invokeWithTimeout('scan-disk', selectedDrive.value)
    console.log('[Renderer] scan-disk result:', result)
    
    clearInterval(progressInterval)
    scanProgress.value = 100
    
    if (result.success) {
      categorizedResults.value = result.data
      
      Object.entries(result.data).forEach(([key, category]) => {
        if (category.files) {
          category.files.forEach(file => {
            if (category.defaultChecked && category.safeToDelete) {
              selectedFiles.value.add(file.path)
            }
            file.needsConfirmation = !category.defaultChecked || !category.safeToDelete
          })
        }
      })
      
      scanComplete.value = true
      console.log('[Renderer] Scan complete, categories:', Object.keys(result.data))
    } else {
      showError('扫描失败: ' + (result.error || '未知错误'))
    }
  } catch (error) {
    clearInterval(progressInterval)
    console.error('[Renderer] Scan error:', error)
    showError('扫描过程中出错: ' + error.message)
  } finally {
    isScanning.value = false
  }
}

const selectCategory = (category) => {
  selectedCategory.value = selectedCategory.value === category ? null : category
}

const isFileSelected = (file) => selectedFiles.value.has(file.path)

const toggleFileSelection = (file) => {
  if (selectedFiles.value.has(file.path)) {
    selectedFiles.value.delete(file.path)
  } else {
    selectedFiles.value.add(file.path)
  }
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    displayedFiles.value.forEach(file => selectedFiles.value.delete(file.path))
  } else {
    displayedFiles.value.forEach(file => {
      if (!file.needsConfirmation || canDeleteConfirm(file)) {
        selectedFiles.value.add(file.path)
      }
    })
  }
}

const canDeleteConfirm = (file) => {
  return true
}

const backToSelection = () => {
  scanComplete.value = false
  deleteComplete.value = false
  selectedDrive.value = null
  selectedCategory.value = null
  categorizedResults.value = {}
  selectedFiles.value.clear()
  scanProgress.value = 0
  deleteProgress.value = 0
  errorMessage.value = ''
}

const confirmDelete = async () => {
  if (selectedFiles.value.size === 0) return
  
  let hasHighRisk = false
  Object.entries(categorizedResults.value).forEach(([key, category]) => {
    if (category.warning || !category.defaultChecked) {
      category.files?.forEach(file => {
        if (selectedFiles.value.has(file.path)) {
          hasHighRisk = true
        }
      })
    }
  })
  
  if (hasHighRisk && electronAvailable.value) {
    try {
      const confirmed = await invokeWithTimeout('show-confirm-dialog', 
        `您选择了 ${selectedCount.value} 个文件，其中包含需要确认的项目。\n\n继续删除吗？`
      )
      if (!confirmed) return
    } catch (error) {
      console.error('[Renderer] Confirm dialog error:', error)
    }
  }
  
  await startDelete()
}

const startDelete = async () => {
  isDeleting.value = true
  deleteProgress.value = 0
  currentDeletingFile.value = ''
  deleteComplete.value = false
  errorMessage.value = ''
  
  const filesToDelete = []
  Object.values(categorizedResults.value).forEach(category => {
    category.files?.forEach(file => {
      if (selectedFiles.value.has(file.path)) {
        filesToDelete.push(file)
      }
    })
  })
  
  console.log('[Renderer] Deleting', filesToDelete.length, 'files')
  
  try {
    const result = await invokeWithTimeout('delete-files', filesToDelete, false)
    
    deleteProgress.value = 100
    isDeleting.value = false
    deleteComplete.value = true
    
    if (result.success) {
      deleteResult.value = result.data
    } else {
      showError('删除失败: ' + (result.error || '未知错误'))
    }
  } catch (error) {
    isDeleting.value = false
    console.error('[Renderer] Delete error:', error)
    showError('删除过程中出错: ' + error.message)
  }
}

const analyzeWithAI = async (file) => {
  if (isAnalyzingAI.value) return
  
  isAnalyzingAI.value = file.path
  showAIModal.value = true
  aiAnalysisFile.value = file
  aiAnalysisResult.value = null
  
  try {
    const result = await invokeWithTimeout('search-file-safety', file.name, file.path)
    
    if (result.success) {
      aiAnalysisResult.value = result.data
      file.aiAnalyzed = true
    } else {
      showError('AI分析失败: ' + (result.error || '未知错误'))
    }
  } catch (error) {
    console.error('[Renderer] AI analysis error:', error)
    showError('AI分析过程中出错: ' + error.message)
  } finally {
    isAnalyzingAI.value = null
  }
}

const closeAIModal = () => {
  showAIModal.value = false
  aiAnalysisResult.value = null
  aiAnalysisFile.value = null
}

const viewFailed = () => {
  console.log('Viewing failed items:', deleteResult.value.failed)
}

const toggleSettings = () => {
  console.log('Settings clicked')
}

let deleteProgressListener = null

onMounted(async () => {
  console.log('[Renderer] Component mounted')
  console.log('[Renderer] electronAvailable:', electronAvailable.value)
  
  try {
    console.log('[Renderer] Testing IPC connection...')
    const pingResult = await invokeWithTimeout('ping')
    console.log('[Renderer] Ping result:', pingResult)
  } catch (error) {
    console.log('[Renderer] Ping failed (expected in mock mode):', error.message)
  }
  
  await loadDrives()
  
  if (electronAvailable.value) {
    deleteProgressListener = (event, data) => {
      console.log('[Renderer] delete-progress event:', data)
      if (isDeleting.value) {
        deleteProgress.value = data.progress
        currentDeletingFile.value = data.currentFile || ''
      }
    }
    ipcRenderer.on('delete-progress', deleteProgressListener)
  }
})

onUnmounted(() => {
  if (deleteProgressListener && electronAvailable.value) {
    ipcRenderer.removeListener('delete-progress', deleteProgressListener)
  }
})
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  color: white;
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-content h1 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 4px;
}

.subtitle {
  font-size: 14px;
  opacity: 0.9;
}

.main-content {
  flex: 1;
  padding: 24px;
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
  position: relative;
}

.error-notification {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  background: var(--danger-color);
  color: white;
  padding: 12px 24px;
  border-radius: var(--radius);
  box-shadow: 0 4px 12px rgba(255, 77, 79, 0.3);
  cursor: pointer;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.error-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.error-content svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.error-close {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  padding: 0 8px;
  opacity: 0.7;
}

.error-close:hover {
  opacity: 1;
}

.drive-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.drive-card {
  border: 2px solid var(--border-color);
  border-radius: var(--radius);
  padding: 20px;
  cursor: pointer;
  transition: var(--transition);
  display: flex;
  align-items: center;
  gap: 16px;
}

.drive-card:hover {
  border-color: var(--primary-color);
  background: rgba(74, 144, 217, 0.05);
}

.drive-card.selected {
  border-color: var(--primary-color);
  background: rgba(74, 144, 217, 0.1);
  box-shadow: 0 0 0 3px rgba(74, 144, 217, 0.2);
}

.drive-icon {
  width: 48px;
  height: 48px;
  color: var(--primary-color);
}

.drive-letter {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
}

.drive-name {
  font-size: 12px;
  color: var(--text-light);
  margin-top: 2px;
}

.action-bar {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.scanning-content,
.deleting-content,
.complete-content {
  text-align: center;
  padding: 40px 20px;
}

.scanning-icon,
.deleting-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.deleting-icon {
  color: var(--danger-color);
}

.complete-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.complete-icon.success {
  background: var(--success-color);
}

.scanning-content h3,
.deleting-content h3,
.complete-content h3 {
  font-size: 20px;
  margin-bottom: 8px;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 16px;
  max-width: 400px;
  margin: 24px auto;
}

.progress-text {
  font-weight: 600;
  min-width: 40px;
}

.current-scanning,
.current-deleting {
  font-size: 12px;
  max-width: 500px;
  margin: 16px auto 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.results-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 24px;
  height: calc(100vh - 200px);
}

.results-sidebar {
  display: flex;
  flex-direction: column;
}

.results-content {
  display: flex;
  flex-direction: column;
}

.results-content > .card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.results-content > .card > .card-body {
  flex: 1;
  overflow: auto;
}

.category-item {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: var(--transition);
}

.category-item:hover {
  background: rgba(74, 144, 217, 0.05);
}

.category-item.active {
  background: rgba(74, 144, 217, 0.1);
  border-left: 3px solid var(--primary-color);
}

.category-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.category-name {
  font-weight: 500;
}

.category-stats {
  font-size: 12px;
  color: var(--text-light);
}

.summary-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-label {
  color: var(--text-light);
  font-size: 13px;
}

.summary-value {
  font-weight: 600;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.file-list {
  max-height: 500px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  transition: var(--transition);
}

.file-item:hover {
  background: var(--bg-color);
}

.file-item.has-warning {
  border-left: 3px solid var(--warning-color);
}

.file-checkbox {
  flex-shrink: 0;
}

.file-icon {
  width: 36px;
  height: 36px;
  color: var(--text-light);
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-path {
  font-size: 12px;
  color: var(--text-light);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-details {
  font-size: 11px;
  margin-top: 4px;
  display: flex;
  gap: 8px;
}

.file-actions {
  flex-shrink: 0;
}

.action-bar-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  margin-top: 16px;
  background: var(--card-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.action-buttons {
  display: flex;
  gap: 12px;
}

.complete-stats {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin: 24px 0;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  color: var(--success-color);
}

.stat-label {
  font-size: 13px;
  color: var(--text-light);
  margin-top: 4px;
}

.complete-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
}

.ai-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.modal-content {
  position: relative;
  background: var(--card-bg);
  border-radius: var(--radius);
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-light);
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: var(--transition);
}

.modal-close:hover {
  background: var(--bg-color);
  color: var(--text-color);
}

.modal-close svg {
  width: 20px;
  height: 20px;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.modal-loading {
  padding: 40px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.ai-file-info {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.ai-file-info .file-name {
  font-size: 16px;
  font-weight: 600;
  word-break: break-all;
}

.ai-result {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-label {
  font-size: 13px;
  color: var(--text-light);
}

.result-value {
  font-size: 14px;
  color: var(--text-color);
  line-height: 1.6;
}

.confidence-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 20px;
}

.confidence-bar > .progress-bar {
  flex: 1;
  height: 8px;
}

.confidence-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.confidence-fill.success {
  background: var(--success-color);
}

.confidence-fill.warning {
  background: var(--warning-color);
}

.confidence-fill.danger {
  background: var(--danger-color);
}

.confidence-text {
  font-size: 13px;
  font-weight: 600;
  min-width: 40px;
}

.warning-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: rgba(250, 173, 20, 0.1);
  border-radius: var(--radius);
  color: var(--warning-color);
}

.warning-item svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}

.warning-text {
  font-size: 14px;
  line-height: 1.5;
}

.mt-16 {
  margin-top: 16px;
}

.ml-auto {
  margin-left: auto;
}
</style>
