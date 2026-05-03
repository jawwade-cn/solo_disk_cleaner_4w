const axios = require('axios')
const path = require('path')

const KNOWN_JUNK_PATTERNS = {
  '.tmp': {
    safe: true,
    description: '临时文件，程序运行时创建，关闭后通常不再需要',
    impact: '无影响，程序会重新生成需要的临时文件'
  },
  '.temp': {
    safe: true,
    description: '临时文件',
    impact: '无影响'
  },
  '.log': {
    safe: true,
    description: '日志文件，记录程序运行信息',
    impact: '删除后无法查看历史日志，但不影响程序运行'
  },
  '.bak': {
    safe: true,
    description: '备份文件，通常由编辑软件自动创建',
    impact: '删除后无法恢复到之前的版本'
  },
  '.old': {
    safe: true,
    description: '旧版本文件',
    impact: '删除后无法使用旧版本'
  },
  '.chk': {
    safe: true,
    description: '磁盘检查恢复的文件碎片',
    impact: '删除后无法恢复这些碎片，但通常这些文件已损坏'
  },
  '.cache': {
    safe: true,
    description: '缓存文件，用于加速程序运行',
    impact: '删除后下次访问会稍慢，但会重新生成'
  },
  '.dmp': {
    safe: true,
    description: '崩溃转储文件，用于调试程序崩溃',
    impact: '删除后无法分析崩溃原因，但不影响系统运行'
  },
  '.etl': {
    safe: true,
    description: '事件跟踪日志文件',
    impact: '删除后无法查看历史性能数据'
  },
  '.evtx': {
    safe: true,
    description: 'Windows事件日志文件',
    impact: '删除后无法查看历史系统事件'
  }
}

const KNOWN_DIRECTORY_PATTERNS = {
  'temp': {
    safe: true,
    description: '系统临时文件夹',
    impact: '删除临时文件是安全的，系统会自动管理'
  },
  'cache': {
    safe: true,
    description: '缓存文件夹',
    impact: '删除缓存会使程序下次启动稍慢，但会重新生成'
  },
  'prefetch': {
    safe: true,
    description: 'Windows预读取文件夹',
    impact: '删除预读取文件会使程序下次启动稍慢，但会重新生成'
  },
  'logs': {
    safe: true,
    description: '日志文件夹',
    impact: '删除日志后无法查看历史记录'
  },
  'crashdumps': {
    safe: true,
    description: '崩溃转储文件夹',
    impact: '删除后无法分析崩溃原因'
  },
  'recent': {
    safe: true,
    description: '最近使用痕迹',
    impact: '删除后不会显示最近打开的文件列表'
  }
}

async function searchFileSafety(fileName, filePath) {
  const ext = path.extname(fileName).toLowerCase()
  const dirPath = path.dirname(filePath).toLowerCase()
  
  let result = {
    safeToDelete: null,
    confidence: 0,
    description: '',
    impact: '',
    warning: null,
    sources: []
  }
  
  if (KNOWN_JUNK_PATTERNS[ext]) {
    const pattern = KNOWN_JUNK_PATTERNS[ext]
    result = {
      ...result,
      safeToDelete: pattern.safe,
      confidence: 90,
      description: pattern.description,
      impact: pattern.impact
    }
  }
  
  for (const [pattern, info] of Object.entries(KNOWN_DIRECTORY_PATTERNS)) {
    if (dirPath.includes(pattern)) {
      if (result.confidence < 95) {
        result = {
          ...result,
          safeToDelete: info.safe,
          confidence: 95,
          description: info.description,
          impact: info.impact
        }
      }
      break
    }
  }
  
  try {
    const networkResult = await searchWebForFileInfo(fileName)
    if (networkResult) {
      result = {
        ...result,
        ...networkResult,
        sources: result.sources.concat(networkResult.sources || [])
      }
    }
  } catch (error) {
    console.log('Network search failed, using local knowledge base')
  }
  
  if (result.confidence < 70) {
    result.warning = '无法确定该文件是否可以安全删除，请谨慎操作'
    result.safeToDelete = false
  }
  
  return result
}

async function searchWebForFileInfo(fileName) {
  const searchQueries = [
    `"${fileName}" can I delete`,
    `"${fileName}" safe to delete windows`,
    `"${path.basename(fileName, path.extname(fileName))}" file purpose`
  ]
  
  for (const query of searchQueries) {
    try {
      const response = await axios.get('https://www.bing.com/search', {
        params: { q: query },
        timeout: 5000
      })
      
      const content = response.data.toLowerCase()
      
      if (content.includes('safe to delete') || 
          content.includes('can delete') ||
          content.includes('temporary file') ||
          content.includes('cache file')) {
        return {
          safeToDelete: true,
          confidence: 85,
          description: '根据网络搜索结果，该文件通常可以安全删除',
          impact: '删除后通常不会影响系统或程序运行',
          sources: ['Bing Search']
        }
      }
      
      if (content.includes('do not delete') ||
          content.includes('important file') ||
          content.includes('system file')) {
        return {
          safeToDelete: false,
          confidence: 90,
          description: '根据网络搜索结果，该文件是重要文件，不建议删除',
          impact: '删除后可能导致系统或程序无法正常运行',
          warning: '该文件是系统或程序的重要组成部分',
          sources: ['Bing Search']
        }
      }
    } catch (error) {
      continue
    }
  }
  
  return null
}

function analyzeFileByPattern(fileName, filePath) {
  const ext = path.extname(fileName).toLowerCase()
  const lowerFileName = fileName.toLowerCase()
  const lowerFilePath = filePath.toLowerCase()
  
  const safePatterns = [
    { pattern: /\.tmp$/, desc: '临时文件' },
    { pattern: /\.temp$/, desc: '临时文件' },
    { pattern: /\.log$/, desc: '日志文件' },
    { pattern: /\.bak$/, desc: '备份文件' },
    { pattern: /\.old$/, desc: '旧版本文件' },
    { pattern: /\.cache$/, desc: '缓存文件' },
    { pattern: /\.dmp$/, desc: '崩溃转储文件' },
    { pattern: /thumbcache_/, desc: '缩略图缓存' },
    { pattern: /~/, desc: '临时备份文件' }
  ]
  
  for (const sp of safePatterns) {
    if (sp.pattern.test(lowerFileName)) {
      return {
        safeToDelete: true,
        confidence: 80,
        description: sp.desc,
        impact: '删除后通常不会产生负面影响'
      }
    }
  }
  
  const unsafePatterns = [
    { pattern: /\.exe$/, desc: '可执行程序' },
    { pattern: /\.dll$/, desc: '动态链接库' },
    { pattern: /\.sys$/, desc: '系统驱动文件' },
    { pattern: /\.drv$/, desc: '驱动程序' },
    { pattern: /\.ocx$/, desc: 'ActiveX控件' }
  ]
  
  for (const up of unsafePatterns) {
    if (up.pattern.test(lowerFileName)) {
      return {
        safeToDelete: false,
        confidence: 95,
        description: up.desc,
        impact: '删除后可能导致程序或系统无法正常运行',
        warning: '该文件是系统或程序的核心文件'
      }
    }
  }
  
  if (lowerFilePath.includes('\\windows\\system32') ||
      lowerFilePath.includes('\\windows\\syswow64') ||
      lowerFilePath.includes('\\program files') ||
      lowerFilePath.includes('\\program files (x86)')) {
    return {
      safeToDelete: false,
      confidence: 90,
      description: '系统或程序目录中的文件',
      impact: '删除后可能导致程序或系统无法正常运行',
      warning: '该文件位于系统关键目录'
    }
  }
  
  return null
}

module.exports = {
  searchFileSafety,
  searchWebForFileInfo,
  analyzeFileByPattern,
  KNOWN_JUNK_PATTERNS,
  KNOWN_DIRECTORY_PATTERNS
}
