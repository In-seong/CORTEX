const { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog } = require('electron')
const { spawn, execSync } = require('child_process')
const path = require('path')
const net = require('net')
const fs = require('fs')

const PORT = 7777
const isDev = !app.isPackaged

let mainWindow = null
let tray = null
let serverProcess = null

function getIconPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'app', 'public', 'icon-512.png')
  }
  return path.join(process.resourcesPath, 'icon-512.png')
}

function findNodeBinary() {
  const nvmDir = process.env.NVM_DIR || path.join(process.env.HOME || '/Users/scoop', '.nvm')
  const nvmVersions = path.join(nvmDir, 'versions', 'node')

  // Find best nvm Node (prefer v20, then highest available)
  let nvmNode = null
  try {
    if (fs.existsSync(nvmVersions)) {
      const versions = fs.readdirSync(nvmVersions)
        .filter(v => v.startsWith('v'))
        .sort((a, b) => {
          const pa = a.slice(1).split('.').map(Number)
          const pb = b.slice(1).split('.').map(Number)
          return pb[0] - pa[0] || pb[1] - pa[1] || pb[2] - pa[2]
        })
      const v20 = versions.find(v => v.startsWith('v20.'))
      const pick = v20 || versions[0]
      if (pick) {
        const bin = path.join(nvmVersions, pick, 'bin', 'node')
        if (fs.existsSync(bin)) nvmNode = bin
      }
    }
  } catch {}

  const candidates = [
    nvmNode,
    process.env.NVM_BIN && path.join(process.env.NVM_BIN, 'node'),
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
  ]

  if (process.platform === 'win32') {
    candidates.push('C:\\Program Files\\nodejs\\node.exe')
    candidates.push(path.join(process.env.APPDATA || '', '..', 'Local', 'Programs', 'nodejs', 'node.exe'))
  }

  try {
    const whichNode = execSync(process.platform === 'win32' ? 'where node' : 'which node', {
      encoding: 'utf8',
      timeout: 3000,
    }).trim().split('\n')[0]
    if (whichNode && !candidates.includes(whichNode)) candidates.push(whichNode)
  } catch {}

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate
  }

  return null
}

function getDbPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'scoop-brain.db')
  }
  const userDataDb = path.join(app.getPath('userData'), 'scoop-brain.db')
  if (!fs.existsSync(userDataDb)) {
    const bundledDb = path.join(process.resourcesPath, 'scoop-brain.db')
    if (fs.existsSync(bundledDb)) {
      fs.copyFileSync(bundledDb, userDataDb)
    }
  }
  return userDataDb
}

function createTray() {
  const iconPath = getIconPath()
  let trayIcon
  try {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 })
  } catch {
    trayIcon = nativeImage.createEmpty()
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('CORTEX')

  const autoStart = app.getLoginItemSettings().openAtLogin

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'CORTEX 열기',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: '시작 시 자동 실행',
      type: 'checkbox',
      checked: autoStart,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked })
      },
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        app.isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show()
    }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'CORTEX',
    backgroundColor: '#08080f',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.loadURL(`http://localhost:${PORT}`)
}

function waitForServer(timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      if (Date.now() - start > timeout) {
        reject(new Error('Server start timeout'))
        return
      }
      const socket = new net.Socket()
      socket.setTimeout(500)
      socket.on('connect', () => {
        socket.destroy()
        resolve()
      })
      socket.on('timeout', () => {
        socket.destroy()
        setTimeout(check, 300)
      })
      socket.on('error', () => {
        setTimeout(check, 300)
      })
      socket.connect(PORT, 'localhost')
    }
    check()
  })
}

function startServer() {
  if (isDev) return Promise.resolve()

  const nodeBin = findNodeBinary()
  if (!nodeBin) {
    dialog.showErrorBox(
      'CORTEX - Node.js 필요',
      'Node.js가 설치되어 있지 않습니다.\nhttps://nodejs.org 에서 설치 후 다시 실행해주세요.'
    )
    app.quit()
    return Promise.reject(new Error('Node.js not found'))
  }

  const serverEntry = path.join(process.resourcesPath, 'server', 'index.mjs')
  const dbPath = getDbPath()

  const modulesPath = path.join(process.resourcesPath, 'node_modules')

  serverProcess = spawn(nodeBin, [serverEntry], {
    env: {
      ...process.env,
      NITRO_PORT: String(PORT),
      NITRO_HOST: 'localhost',
      NODE_ENV: 'production',
      DB_PATH: dbPath,
      NODE_PATH: modulesPath,
    },
    stdio: 'pipe',
    cwd: process.resourcesPath,
  })

  serverProcess.stdout.on('data', (data) => {
    console.log('[server]', data.toString().trim())
  })

  serverProcess.stderr.on('data', (data) => {
    console.error('[server]', data.toString().trim())
  })

  serverProcess.on('exit', (code) => {
    console.log('[server] exited with code', code)
    if (!app.isQuitting && code !== 0) {
      dialog.showErrorBox('CORTEX', '서버가 예기치 않게 종료되었습니다.')
    }
  })

  return waitForServer()
}

app.whenReady().then(async () => {
  createTray()

  try {
    if (isDev) {
      await waitForServer()
    } else {
      await startServer()
    }
    createWindow()
  } catch (err) {
    dialog.showErrorBox('CORTEX', `시작 실패: ${err.message}`)
    app.quit()
  }

  app.on('activate', () => {
    if (mainWindow) mainWindow.show()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  app.isQuitting = true
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
})
