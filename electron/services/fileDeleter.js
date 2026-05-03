const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

async function deleteFiles(files, progressCallback) {
  const results = {
    success: [],
    failed: [],
    skipped: [],
    totalDeleted: 0,
    totalFailed: 0
  }
  
  let processed = 0
  const total = files.length
  
  for (const file of files) {
    try {
      await deleteFile(file)
      results.success.push(file)
      results.totalDeleted += file.size || 0
    } catch (error) {
      results.failed.push({
        file: file,
        error: error.message
      })
      results.totalFailed++
    }
    
    processed++
    if (progressCallback) {
      progressCallback(Math.round((processed / total) * 100), file)
    }
  }
  
  return results
}

async function deleteFile(file) {
  return new Promise((resolve, reject) => {
    const filePath = file.path
    
    fs.unlink(filePath, (err) => {
      if (err) {
        if (err.code === 'ENOENT') {
          resolve()
        } else if (err.code === 'EPERM' || err.code === 'EACCES') {
          tryDeleteWithAdmin(filePath)
            .then(resolve)
            .catch(reject)
        } else {
          reject(new Error(`删除失败: ${err.message}`))
        }
      } else {
        resolve()
      }
    })
  })
}

async function tryDeleteWithAdmin(filePath) {
  try {
    const { stdout, stderr } = await execAsync(`del /f /q "${filePath}"`)
    return true
  } catch (error) {
    throw new Error(`权限不足，无法删除该文件`)
  }
}

async function moveToRecycleBin(files) {
  const trash = require('trash')
  const filePaths = files.map(f => f.path)
  
  try {
    await trash(filePaths)
    return {
      success: files,
      failed: []
    }
  } catch (error) {
    return {
      success: [],
      failed: files.map(f => ({
        file: f,
        error: error.message
      }))
    }
  }
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

module.exports = {
  deleteFiles,
  deleteFile,
  moveToRecycleBin,
  formatSize
}
