const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const { scanDisk, getDrives } = require('./services/diskScanner')
const { classifyJunk } = require('./services/junkClassifier')
const { searchFileSafety } = require('./services/aiSearch')
const { deleteFiles, moveToRecycleBin, formatSize } = require('./services/fileDeleter')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, '../public/icon.ico')
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('get-drives', async () => {
  try {
    const drives = await getDrives()
    return { success: true, data: drives }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('scan-disk', async (event, driveLetter) => {
  try {
    const files = await scanDisk(driveLetter)
    const classifiedFiles = classifyJunk(files)
    return { success: true, data: classifiedFiles }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('search-file-safety', async (event, fileName, filePath) => {
  try {
    const result = await searchFileSafety(fileName, filePath)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('delete-files', async (event, files, useRecycleBin = false) => {
  try {
    let result
    
    if (useRecycleBin) {
      result = await moveToRecycleBin(files)
    } else {
      result = await deleteFiles(files, (progress, currentFile) => {
        if (mainWindow) {
          mainWindow.webContents.send('delete-progress', {
            progress,
            currentFile: currentFile ? currentFile.name : null
          })
        }
      })
    }
    
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('show-confirm-dialog', async (event, message) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['取消', '确认删除'],
    defaultId: 0,
    cancelId: 0,
    title: '确认删除',
    message: message
  })
  
  return result.response === 1
})

ipcMain.handle('format-size', async (event, bytes) => {
  return formatSize(bytes)
})
