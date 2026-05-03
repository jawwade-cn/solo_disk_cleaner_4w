const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

async function getDrives() {
  try {
    const { stdout } = await execAsync('wmic logicaldisk get name, drivetype, volumename')
    const lines = stdout.trim().split('\n').slice(1)
    const drives = []
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 2 && parts[1] === '3') {
        drives.push({
          letter: parts[0],
          type: 'Local Disk',
          name: parts.slice(2).join(' ') || 'Local Disk'
        })
      }
    }
    
    return drives
  } catch (error) {
    console.error('Error getting drives:', error)
    return []
  }
}

async function scanDisk(driveLetter, progressCallback) {
  const allFiles = []
  const userProfile = process.env.USERPROFILE || ''
  const windowsDir = process.env.WINDIR || 'C:\\Windows'
  
  const scanPaths = [
    path.join(userProfile, 'AppData', 'Local', 'Temp'),
    path.join(windowsDir, 'Temp'),
    path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'Windows', 'INetCache'),
    path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'Windows', 'Explorer'),
    path.join(driveLetter, '\\', '$Recycle.Bin'),
    path.join(userProfile, 'Recent'),
    path.join(windowsDir, 'Prefetch'),
    path.join(userProfile, 'AppData', 'Local', 'CrashDumps'),
    path.join(windowsDir, 'Logs'),
    path.join(windowsDir, 'System32', 'LogFiles'),
  ]
  
  const browserCachePaths = [
    path.join(userProfile, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
    path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
    path.join(userProfile, 'AppData', 'Local', 'Mozilla', 'Firefox', 'Profiles'),
  ]
  
  scanPaths.push(...browserCachePaths)
  
  let processedPaths = 0
  const totalPaths = scanPaths.length
  
  for (const scanPath of scanPaths) {
    if (fs.existsSync(scanPath)) {
      try {
        const files = await scanDirectory(scanPath)
        allFiles.push(...files)
      } catch (error) {
        console.error(`Error scanning ${scanPath}:`, error)
      }
    }
    
    processedPaths++
    if (progressCallback) {
      progressCallback(Math.round((processedPaths / totalPaths) * 100))
    }
  }
  
  return allFiles
}

async function scanDirectory(dir, files = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      
      try {
        if (entry.isDirectory()) {
          await scanDirectory(fullPath, files)
        } else {
          const stats = fs.statSync(fullPath)
          files.push({
            path: fullPath,
            name: entry.name,
            size: stats.size,
            modifiedTime: stats.mtime,
            extension: path.extname(entry.name).toLowerCase()
          })
        }
      } catch (error) {
        // Skip files that can't be accessed
      }
    }
  } catch (error) {
    // Skip directories that can't be accessed
  }
  
  return files
}

module.exports = {
  getDrives,
  scanDisk
}
