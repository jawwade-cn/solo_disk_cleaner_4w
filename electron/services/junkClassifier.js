const path = require('path')

const JUNK_CATEGORIES = {
  SYSTEM_TEMP: {
    name: '系统临时文件',
    description: 'Windows系统产生的临时文件，删除后不会影响系统运行',
    safeToDelete: true,
    defaultChecked: true,
    priority: 1
  },
  BROWSER_CACHE: {
    name: '浏览器缓存',
    description: 'Chrome、Edge、Firefox等浏览器的缓存文件，删除后会重新下载',
    safeToDelete: true,
    defaultChecked: true,
    priority: 2
  },
  RECYCLE_BIN: {
    name: '回收站',
    description: '回收站中的文件，删除后无法通过回收站恢复',
    safeToDelete: true,
    defaultChecked: false,
    priority: 3,
    warning: '删除后文件将永久丢失'
  },
  PREFETCH: {
    name: '预读取文件',
    description: 'Windows预读取缓存，用于加快程序启动速度',
    safeToDelete: true,
    defaultChecked: false,
    priority: 4,
    note: '删除后下次启动程序会稍慢'
  },
  RECENT_FILES: {
    name: '最近使用痕迹',
    description: '最近打开的文档和程序快捷方式',
    safeToDelete: true,
    defaultChecked: false,
    priority: 5
  },
  CRASH_DUMPS: {
    name: '崩溃转储文件',
    description: '程序崩溃时生成的调试文件',
    safeToDelete: true,
    defaultChecked: true,
    priority: 6
  },
  LOG_FILES: {
    name: '系统日志',
    description: 'Windows系统和应用程序的日志文件',
    safeToDelete: true,
    defaultChecked: true,
    priority: 7
  },
  SHORTCUTS: {
    name: '无效快捷方式',
    description: '指向不存在文件的快捷方式',
    safeToDelete: true,
    defaultChecked: true,
    priority: 8
  },
  SOFTWARE_CACHE: {
    name: '软件缓存',
    description: '常用软件产生的缓存文件',
    safeToDelete: true,
    defaultChecked: true,
    priority: 9
  },
  REGISTRY_BACKUPS: {
    name: '注册表备份',
    description: '旧的注册表备份文件',
    safeToDelete: true,
    defaultChecked: false,
    priority: 10,
    note: '保留最新备份可用于系统恢复'
  }
}

const SAFE_EXTENSIONS = new Set([
  '.tmp', '.temp', '.log', '.bak', '.old', '.chk', '.gid',
  '.syd', '.$$$', '.~mp', '.dmp', '.crash', '.mdmp',
  '.cache', '.thumbcache', '.etl', '.evtx'
])

const BROWSER_CACHE_DIRS = [
  'Cache', 'Code Cache', 'GPUCache', 'Media Cache',
  'Application Cache', 'Service Worker', 'ShaderCache'
]

const TEMP_DIRS = [
  'Temp', 'Temporary Internet Files', 'INetCache',
  'Offline Web Pages', 'Cookies'
]

function classifyJunk(files) {
  const categorizedFiles = {}
  const userProfile = process.env.USERPROFILE || ''
  const windowsDir = process.env.WINDIR || 'C:\\Windows'
  
  Object.keys(JUNK_CATEGORIES).forEach(category => {
    categorizedFiles[category] = {
      ...JUNK_CATEGORIES[category],
      files: [],
      totalSize: 0
    }
  })
  
  for (const file of files) {
    const category = categorizeFile(file, userProfile, windowsDir)
    if (category && categorizedFiles[category]) {
      categorizedFiles[category].files.push(file)
      categorizedFiles[category].totalSize += file.size
    }
  }
  
  const result = {}
  Object.keys(categorizedFiles).forEach(category => {
    if (categorizedFiles[category].files.length > 0) {
      result[category] = categorizedFiles[category]
    }
  })
  
  return result
}

function categorizeFile(file, userProfile, windowsDir) {
  const filePath = file.path.toLowerCase()
  const fileName = file.name.toLowerCase()
  const ext = file.extension
  
  if (filePath.includes('$recycle.bin')) {
    return 'RECYCLE_BIN'
  }
  
  if (filePath.includes('prefetch')) {
    return 'PREFETCH'
  }
  
  if (filePath.includes('recent') || filePath.includes('\\appdata\\roaming\\microsoft\\windows\\recent')) {
    return 'RECENT_FILES'
  }
  
  if (filePath.includes('crashdumps') || fileName.includes('crash') || fileName.includes('dump') || ext === '.dmp' || ext === '.mdmp') {
    return 'CRASH_DUMPS'
  }
  
  if (filePath.includes('\\logs') || filePath.includes('\\logfiles') || ext === '.log' || ext === '.etl' || ext === '.evtx') {
    return 'LOG_FILES'
  }
  
  for (const browserDir of BROWSER_CACHE_DIRS) {
    if (filePath.includes(`\\${browserDir.toLowerCase()}\\`)) {
      return 'BROWSER_CACHE'
    }
  }
  
  for (const tempDir of TEMP_DIRS) {
    if (filePath.includes(`\\${tempDir.toLowerCase()}\\`)) {
      return 'SYSTEM_TEMP'
    }
  }
  
  if (SAFE_EXTENSIONS.has(ext)) {
    return 'SYSTEM_TEMP'
  }
  
  if (filePath.includes('\\appdata\\local\\packages')) {
    return 'SOFTWARE_CACHE'
  }
  
  if (ext === '.lnk') {
    return 'SHORTCUTS'
  }
  
  if (filePath.includes('\\regback') || fileName.includes('registry') || fileName.includes('regback')) {
    return 'REGISTRY_BACKUPS'
  }
  
  return null
}

function isFileSafeToDelete(file) {
  const ext = file.extension.toLowerCase()
  const filePath = file.path.toLowerCase()
  
  const unsafeDirs = [
    '\\windows\\system32',
    '\\windows\\syswow64',
    '\\program files',
    '\\program files (x86)',
    '\\windows\\winSxS',
    '\\windows\\assembly'
  ]
  
  for (const unsafeDir of unsafeDirs) {
    if (filePath.includes(unsafeDir)) {
      return false
    }
  }
  
  const unsafeExtensions = ['.exe', '.dll', '.sys', '.drv', '.ocx', '.cpl', '.scr']
  if (unsafeExtensions.includes(ext)) {
    return false
  }
  
  return true
}

module.exports = {
  classifyJunk,
  categorizeFile,
  isFileSafeToDelete,
  JUNK_CATEGORIES
}
