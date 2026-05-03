const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

const DEFAULT_TIMEOUT = 30000
const SCAN_TIMEOUT = 60000
const MAX_SCAN_DEPTH = 5
const MAX_FILES_PER_DIR = 500

function withTimeout(promise, timeout, errorMessage) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMessage || `Operation timed out after ${timeout}ms`))
    }, timeout)
    
    promise
      .then((result) => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

async function getDrives() {
  console.log('[diskScanner] Getting drives...')
  
  try {
    const drives = await getDrivesViaWmic()
    
    if (drives.length > 0) {
      console.log(`[diskScanner] Found ${drives.length} drives via wmic`)
      return drives
    }
    
    console.log('[diskScanner] wmic returned empty, trying fallback method...')
    const fallbackDrives = await getDrivesViaFallback()
    console.log(`[diskScanner] Found ${fallbackDrives.length} drives via fallback`)
    return fallbackDrives
    
  } catch (error) {
    console.error('[diskScanner] Error getting drives:', error.message)
    console.log('[diskScanner] Using fallback drives list')
    return getDrivesViaFallback()
  }
}

async function getDrivesViaWmic() {
  try {
    console.log('[diskScanner] Executing wmic command...')
    
    const { stdout } = await withTimeout(
      execAsync('wmic logicaldisk get name, drivetype, volumename', {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024
      }),
      DEFAULT_TIMEOUT,
      'wmic command timed out'
    )
    
    console.log('[diskScanner] wmic output received, parsing...')
    console.log('[diskScanner] wmic stdout:', stdout.substring(0, 500))
    
    const lines = stdout.trim().split('\n').filter(line => line.trim())
    
    if (lines.length <= 1) {
      console.log('[diskScanner] wmic returned only header line')
      return []
    }
    
    const drives = []
    const headerLine = lines[0]
    const nameIndex = headerLine.indexOf('Name')
    const driveTypeIndex = headerLine.indexOf('DriveType')
    const volumeNameIndex = headerLine.indexOf('VolumeName')
    
    console.log(`[diskScanner] Column indices - Name:${nameIndex}, DriveType:${driveTypeIndex}, VolumeName:${volumeNameIndex}`)
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      console.log(`[diskScanner] Processing line ${i}: "${line}"`)
      
      let driveLetter = ''
      let driveType = ''
      let volumeName = ''
      
      if (nameIndex >= 0 && driveTypeIndex >= 0) {
        driveLetter = line.substring(nameIndex, nameIndex + 2).trim()
        driveType = line.substring(driveTypeIndex, driveTypeIndex + 3).trim()
        
        if (volumeNameIndex >= 0) {
          volumeName = line.substring(volumeNameIndex).trim()
        }
      }
      
      if (!driveLetter) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 1) {
          driveLetter = parts[0]
          if (parts.length >= 2) driveType = parts[1]
          if (parts.length >= 3) volumeName = parts.slice(2).join(' ')
        }
      }
      
      console.log(`[diskScanner] Parsed - Letter:${driveLetter}, Type:${driveType}, Name:${volumeName}`)
      
      if (driveLetter && (driveType === '3' || driveLetter.match(/^[A-Za-z]:$/))) {
        drives.push({
          letter: driveLetter.endsWith(':') ? driveLetter : driveLetter + ':',
          type: 'Local Disk',
          name: volumeName || 'Local Disk'
        })
      }
    }
    
    console.log(`[diskScanner] Parsed ${drives.length} drives from wmic`)
    return drives
    
  } catch (error) {
    console.error('[diskScanner] wmic method failed:', error.message)
    throw error
  }
}

async function getDrivesViaFallback() {
  console.log('[diskScanner] Using fallback drive detection...')
  
  const drives = []
  const commonDrives = ['C:', 'D:', 'E:', 'F:', 'G:', 'H:']
  
  for (const drive of commonDrives) {
    try {
      const testPath = path.join(drive, '\\')
      
      if (fs.existsSync(testPath)) {
        const stats = fs.statSync(testPath)
        
        if (stats.isDirectory()) {
          let volumeName = 'Local Disk'
          
          try {
            const labelFile = path.join(drive, 'label.txt')
            if (fs.existsSync(labelFile)) {
              volumeName = fs.readFileSync(labelFile, 'utf8').trim()
            }
          } catch (e) {}
          
          if (drive === 'C:') {
            volumeName = '系统盘'
          } else if (drive === 'D:') {
            volumeName = '数据盘'
          }
          
          drives.push({
            letter: drive,
            type: 'Local Disk',
            name: volumeName
          })
          
          console.log(`[diskScanner] Found drive ${drive} via fallback`)
        }
      }
    } catch (error) {
      console.log(`[diskScanner] Drive ${drive} not accessible:`, error.message)
    }
  }
  
  if (drives.length === 0) {
    console.log('[diskScanner] No drives found via fallback, using default C: drive')
    drives.push({
      letter: 'C:',
      type: 'Local Disk',
      name: '系统盘'
    })
  }
  
  return drives
}

async function scanDisk(driveLetter, progressCallback) {
  console.log(`[diskScanner] Starting scan for drive ${driveLetter}...`)
  
  const allFiles = []
  const userProfile = process.env.USERPROFILE || 'C:\\Users\\Default'
  const windowsDir = process.env.WINDIR || 'C:\\Windows'
  
  console.log(`[diskScanner] UserProfile: ${userProfile}`)
  console.log(`[diskScanner] WindowsDir: ${windowsDir}`)
  
  const scanPaths = getScanPaths(driveLetter, userProfile, windowsDir)
  
  console.log(`[diskScanner] Scan paths:`, scanPaths)
  
  let processedPaths = 0
  const totalPaths = scanPaths.length
  
  for (const scanPath of scanPaths) {
    try {
      console.log(`[diskScanner] Scanning path: ${scanPath}`)
      
      if (fs.existsSync(scanPath)) {
        const files = await scanDirectorySafe(scanPath, 0, MAX_SCAN_DEPTH)
        console.log(`[diskScanner] Found ${files.length} files in ${scanPath}`)
        allFiles.push(...files)
      } else {
        console.log(`[diskScanner] Path does not exist: ${scanPath}`)
      }
    } catch (error) {
      console.error(`[diskScanner] Error scanning ${scanPath}:`, error.message)
    }
    
    processedPaths++
    const progress = Math.round((processedPaths / totalPaths) * 100)
    console.log(`[diskScanner] Scan progress: ${progress}%`)
    
    if (progressCallback) {
      progressCallback(progress)
    }
    
    await delay(50)
  }
  
  console.log(`[diskScanner] Scan complete. Total files found: ${allFiles.length}`)
  return allFiles
}

function getScanPaths(driveLetter, userProfile, windowsDir) {
  const paths = []
  
  paths.push(path.join(userProfile, 'AppData', 'Local', 'Temp'))
  paths.push(path.join(windowsDir, 'Temp'))
  
  if (driveLetter === 'C:') {
    paths.push(path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'Windows', 'INetCache'))
    paths.push(path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'Windows', 'Explorer'))
    paths.push(path.join(userProfile, 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Recent'))
    paths.push(path.join(windowsDir, 'Prefetch'))
    paths.push(path.join(userProfile, 'AppData', 'Local', 'CrashDumps'))
    paths.push(path.join(windowsDir, 'Logs'))
    paths.push(path.join(windowsDir, 'System32', 'LogFiles'))
    
    paths.push(path.join(userProfile, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Cache'))
    paths.push(path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'))
    paths.push(path.join(userProfile, 'AppData', 'Local', 'Mozilla', 'Firefox', 'Profiles'))
    
    paths.push(path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'Windows', 'Temporary Internet Files'))
    paths.push(path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'Windows', 'WebCache'))
    paths.push(path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'Windows', 'Explorer', 'thumbcache_*.db'))
  }
  
  return paths
}

async function scanDirectorySafe(dir, currentDepth, maxDepth, files = [], scannedPaths = new Set()) {
  if (currentDepth > maxDepth) {
    return files
  }
  
  const normalizedPath = path.normalize(dir).toLowerCase()
  if (scannedPaths.has(normalizedPath)) {
    return files
  }
  scannedPaths.add(normalizedPath)
  
  try {
    let entries
    
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch (readError) {
      console.log(`[diskScanner] Cannot read directory ${dir}:`, readError.message)
      return files
    }
    
    let fileCount = 0
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      
      try {
        if (shouldSkipPath(entry.name, fullPath)) {
          continue
        }
        
        if (entry.isDirectory()) {
          await scanDirectorySafe(fullPath, currentDepth + 1, maxDepth, files, scannedPaths)
        } else {
          if (fileCount < MAX_FILES_PER_DIR) {
            try {
              const stats = fs.statSync(fullPath)
              
              if (stats.size > 0 && isSafeFileType(entry.name)) {
                files.push({
                  path: fullPath,
                  name: entry.name,
                  size: stats.size,
                  modifiedTime: stats.mtime,
                  extension: path.extname(entry.name).toLowerCase()
                })
                fileCount++
              }
            } catch (statError) {
              continue
            }
          }
        }
      } catch (error) {
        continue
      }
      
      if (files.length % 100 === 0) {
        await delay(10)
      }
    }
    
  } catch (error) {
    console.log(`[diskScanner] Error in scanDirectorySafe ${dir}:`, error.message)
  }
  
  return files
}

function shouldSkipPath(name, fullPath) {
  const lowerName = name.toLowerCase()
  const lowerPath = fullPath.toLowerCase()
  
  const skipNames = [
    '..', '.', 'system volume information', '$recycle.bin',
    'program files', 'program files (x86)', 'windows',
    'appdata\\roaming\\microsoft\\windows\\start menu',
    'appdata\\local\\microsoft\\windowsapps',
    'node_modules', '.git', '.svn', '.hg'
  ]
  
  for (const skip of skipNames) {
    if (lowerName === skip || lowerPath.includes('\\' + skip + '\\')) {
      return true
    }
  }
  
  return false
}

function isSafeFileType(name) {
  const lowerName = name.toLowerCase()
  
  const safeExtensions = [
    '.tmp', '.temp', '.log', '.bak', '.old', '.chk', '.gid',
    '.syd', '$$$', '.~mp', '.dmp', '.crash', '.mdmp',
    '.cache', '.etl', '.evtx', '.thumbcache',
    '.tmp.txt', '.temp.txt'
  ]
  
  const ext = path.extname(lowerName)
  if (safeExtensions.includes(ext)) {
    return true
  }
  
  if (lowerName.startsWith('~$') || lowerName.startsWith('.')) {
    return true
  }
  
  if (lowerName.includes('cache') || lowerName.includes('temp') || 
      lowerName.includes('tmp') || lowerName.includes('log')) {
    return true
  }
  
  return false
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
  getDrives,
  scanDisk,
  getDrivesViaWmic,
  getDrivesViaFallback
}
