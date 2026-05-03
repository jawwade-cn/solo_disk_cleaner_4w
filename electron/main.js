const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const { scanDisk, getDrives } = require('./services/diskScanner')
const { classifyJunk } = require('./services/junkClassifier')
const { searchFileSafety } = require('./services/aiSearch')
const { deleteFiles, moveToRecycleBin, formatSize } = require('./services/fileDeleter')

console.log('[main] Electron main process starting...')
console.log('[main] Node version:', process.version)
console.log('[main] Electron version:', process.versions.electron)
console.log('[main] Platform:', process.platform)
console.log('[main] UserProfile:', process.env.USERPROFILE)
console.log('[main] WindowsDir:', process.env.WINDIR)

let mainWindow = null

function createWindow() {
  console.log('[main] Creating browser window...')
  
  try {
    const windowOptions = {
      width: 1200,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      },
      title: 'Solo Disk Cleaner',
      show: false
    }
    
    console.log('[main] Window options:', JSON.stringify(windowOptions, null, 2))
    
    mainWindow = new BrowserWindow(windowOptions)
    
    mainWindow.once('ready-to-show', () => {
      console.log('[main] Window ready to show')
      mainWindow.show()
    })
    
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
    
    console.log('[main] Is development mode:', isDev)
    
    if (isDev) {
      const devUrl = 'http://localhost:5173'
      console.log(`[main] Loading development URL: ${devUrl}`)
      
      mainWindow.loadURL(devUrl).catch(err => {
        console.error('[main] Failed to load dev URL:', err.message)
        console.log('[main] Falling back to local file...')
        
        const localHtml = path.join(__dirname, '../dist/index.html')
        console.log(`[main] Trying local file: ${localHtml}`)
        
        mainWindow.loadFile(localHtml).catch(err2 => {
          console.error('[main] Also failed to load local file:', err2.message)
        })
      })
      
      console.log('[main] Opening dev tools...')
      mainWindow.webContents.openDevTools()
    } else {
      const distPath = path.join(__dirname, '../dist/index.html')
      console.log(`[main] Loading production file: ${distPath}`)
      mainWindow.loadFile(distPath)
    }
    
    mainWindow.on('closed', () => {
      console.log('[main] Window closed')
      mainWindow = null
    })
    
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('[main] WebContents did-fail-load:')
      console.error('[main]   Error code:', errorCode)
      console.error('[main]   Description:', errorDescription)
      console.error('[main]   URL:', validatedURL)
    })
    
    mainWindow.webContents.on('dom-ready', () => {
      console.log('[main] DOM ready')
    })
    
    console.log('[main] Browser window created successfully')
    
  } catch (error) {
    console.error('[main] Failed to create browser window:', error)
    console.error('[main] Error stack:', error.stack)
  }
}

app.whenReady().then(() => {
  console.log('[main] App ready, creating window...')
  createWindow()

  app.on('activate', () => {
    console.log('[main] App activate event')
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
}).catch(error => {
  console.error('[main] App whenReady failed:', error)
})

app.on('window-all-closed', () => {
  console.log('[main] All windows closed')
  if (process.platform !== 'darwin') {
    console.log('[main] Quitting app...')
    app.quit()
  }
})

app.on('error', (error) => {
  console.error('[main] App error:', error)
})

ipcMain.handle('get-drives', async (event) => {
  console.log('[main] IPC: get-drives called')
  
  try {
    console.log('[main] Calling getDrives()...')
    const drives = await getDrives()
    console.log('[main] getDrives returned:', JSON.stringify(drives, null, 2))
    
    return { 
      success: true, 
      data: drives 
    }
    
  } catch (error) {
    console.error('[main] get-drives error:', error)
    console.error('[main] Error stack:', error.stack)
    
    return { 
      success: false, 
      error: error.message || 'Unknown error' 
    }
  }
})

ipcMain.handle('scan-disk', async (event, driveLetter) => {
  console.log('[main] IPC: scan-disk called with drive:', driveLetter)
  
  try {
    console.log(`[main] Scanning drive ${driveLetter}...`)
    const files = await scanDisk(driveLetter)
    console.log(`[main] scanDisk found ${files.length} files`)
    
    console.log('[main] Classifying junk files...')
    const classifiedFiles = classifyJunk(files)
    
    const categoryCount = Object.keys(classifiedFiles).length
    let totalFiles = 0
    Object.values(classifiedFiles).forEach(cat => {
      totalFiles += cat.files ? cat.files.length : 0
    })
    
    console.log(`[main] Classified into ${categoryCount} categories, total ${totalFiles} files`)
    
    return { 
      success: true, 
      data: classifiedFiles 
    }
    
  } catch (error) {
    console.error('[main] scan-disk error:', error)
    console.error('[main] Error stack:', error.stack)
    
    return { 
      success: false, 
      error: error.message || 'Scan failed' 
    }
  }
})

ipcMain.handle('search-file-safety', async (event, fileName, filePath) => {
  console.log('[main] IPC: search-file-safety called for:', fileName)
  
  try {
    const result = await searchFileSafety(fileName, filePath)
    console.log('[main] search-file-safety result:', JSON.stringify(result, null, 2))
    
    return { 
      success: true, 
      data: result 
    }
    
  } catch (error) {
    console.error('[main] search-file-safety error:', error)
    return { 
      success: false, 
      error: error.message 
    }
  }
})

ipcMain.handle('delete-files', async (event, files, useRecycleBin = false) => {
  console.log('[main] IPC: delete-files called, count:', files ? files.length : 0)
  console.log('[main] Use recycle bin:', useRecycleBin)
  
  try {
    let result
    
    if (useRecycleBin) {
      console.log('[main] Moving to recycle bin...')
      result = await moveToRecycleBin(files)
    } else {
      console.log('[main] Permanently deleting files...')
      result = await deleteFiles(files, (progress, currentFile) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('delete-progress', {
            progress,
            currentFile: currentFile ? currentFile.name : null
          })
        }
      })
    }
    
    console.log('[main] Delete result:', JSON.stringify(result, null, 2))
    
    return { 
      success: true, 
      data: result 
    }
    
  } catch (error) {
    console.error('[main] delete-files error:', error)
    return { 
      success: false, 
      error: error.message 
    }
  }
})

ipcMain.handle('show-confirm-dialog', async (event, message) => {
  console.log('[main] IPC: show-confirm-dialog called')
  console.log('[main] Message:', message)
  
  try {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['取消', '确认删除'],
      defaultId: 0,
      cancelId: 0,
      title: '确认删除',
      message: message
    })
    
    console.log('[main] Dialog result:', result.response)
    return result.response === 1
    
  } catch (error) {
    console.error('[main] show-confirm-dialog error:', error)
    return false
  }
})

ipcMain.handle('format-size', async (event, bytes) => {
  return formatSize(bytes)
})

ipcMain.handle('ping', async (event) => {
  console.log('[main] IPC: ping received')
  return { success: true, timestamp: Date.now() }
})

console.log('[main] Main process setup complete, waiting for app ready...')
