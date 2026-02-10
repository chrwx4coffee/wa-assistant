import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { Client, LocalAuth } from 'whatsapp-web.js'
import qrcode from 'qrcode'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
global.__dirname = __dirname

const logPath = path.join(app.getPath('userData'), 'app.log')

function log(msg) {
    const timestamp = new Date().toISOString()
    try {
        fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`)
        console.log(`[${timestamp}] ${msg}`)
    } catch (e) {
        console.error('Failed to log:', e)
    }
}

function getChromiumPath() {
    const platform = process.platform;
    let executablePath = '';

    if (platform === 'win32') {
        // Windows: Check common installation paths for Chrome
        const possiblePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
            path.join(process.env.PROGRAMFILES || '', 'Google\\Chrome\\Application\\chrome.exe'),
            path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google\\Chrome\\Application\\chrome.exe')
        ];
        executablePath = possiblePaths.find(p => fs.existsSync(p)) || '';
    } else if (platform === 'darwin') {
        // macOS: Standard path
        executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        if (!fs.existsSync(executablePath)) {
            executablePath = '/Applications/Chromium.app/Contents/MacOS/Chromium';
        }
    } else if (platform === 'linux') {
        // Linux: Check common binary names
        const possiblePaths = [
            '/usr/bin/chromium',
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/snap/bin/chromium'
        ];
        executablePath = possiblePaths.find(p => fs.existsSync(p)) || '';
    }

    log(`Detected platform: ${platform}, using browser executable: ${executablePath || 'Not found (Puppeteer will attempt to use bundled)'}`);

    // If we return null/undefined/empty string, Puppeteer might try to use its bundled version (if installed)
    // or fail. Returning undefined lets Puppeteer decide if we didn't find a system one.
    return executablePath || undefined;
}

log('Main process initializing...')

process.env.APP_ROOT = path.join(__dirname, '..')

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win
let client

function createWindow() {
    log('Creating window...')
    const preloadPath = path.join(__dirname, 'preload.js')
    log(`Preload path: ${preloadPath}`)

    win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
        },
        title: 'WhatsApp Mesaj Asistanı',
        autoHideMenuBar: true,
    })

    // Test active push
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(RENDERER_DIST, 'index.html'))
    }
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.whenReady().then(createWindow)

// WhatsApp Logic
ipcMain.on('wa-initialize', async (event) => {
    log('IPC: wa-initialize received')
    try {
        if (client) {
            log('Client already exists, returning status')
            win?.webContents.send('wa-loading-screen', { percent: 100, message: 'WhatsApp zaten yayında.' })
            return
        }

        win?.webContents.send('wa-loading-screen', { percent: 10, message: 'Tarayıcı hazırlanıyor...' })

        client = new Client({
            authStrategy: new LocalAuth({
                dataPath: path.join(app.getPath('userData'), 'wa-sessions')
            }),
            puppeteer: {
                executablePath: getChromiumPath(),
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ],
            }
        })

        client.on('qr', (qr) => {
            log('QR Received')
            qrcode.toDataURL(qr, (err, url) => {
                win?.webContents.send('wa-qr', url)
            })
        })

        client.on('ready', () => {
            log('Client is ready!')
            win?.webContents.send('wa-ready')
        })

        client.on('authenticated', () => {
            log('Authenticated')
            win?.webContents.send('wa-authenticated')
        })

        client.on('auth_failure', (msg) => {
            log('Auth failure: ' + msg)
            win?.webContents.send('wa-auth-failure', msg)
        })

        client.on('loading_screen', (percent, message) => {
            log(`Loading: ${message} (${percent}%)`)
            win?.webContents.send('wa-loading-screen', { percent, message })
        })

        log('Initializing client...')
        await client.initialize().catch(err => {
            log('Client Init Error: ' + err.message)
            win?.webContents.send('wa-auth-failure', 'WhatsApp başlatılamadı: ' + err.message)
        })

    } catch (error) {
        log('WA Init Catch: ' + error.message)
        win?.webContents.send('wa-auth-failure', 'Beklenmedik hata: ' + error.message)
    }
})

ipcMain.on('wa-get-contacts', async (event) => {
    if (!client) return
    log('Fetching contacts...')
    try {
        const contacts = await client.getContacts()

        // Filter: Include individual users and groups, exclude status/broadcast and self
        const filtered = contacts
            .filter(c => {
                // Strict Filter: Only allow 'c.us' (User) and 'g.us' (Group)
                const isUser = c.id.server === 'c.us'
                const isGroup = c.id.server === 'g.us'

                return isUser || isGroup
            })
            .map(c => ({
                id: c.id._serialized,
                name: c.name || c.pushname || c.shortName || c.number || 'Bilinmeyen Kişi',
                number: c.number,
                isGroup: c.isGroup,
                isCommunity: c.isCommunity || false,
                isMyContact: c.isMyContact
            }))

        log(`Fetched ${filtered.length} valid contacts.`)
        win?.webContents.send('wa-contacts', filtered)
    } catch (err) {
        log('Error fetching contacts: ' + err.message)
    }
})

ipcMain.on('wa-send-bulk', async (event, { messages }) => {
    if (!client) return

    for (let i = 0; i < messages.length; i++) {
        const { to, body } = messages[i]

        try {
            const chat = await client.getChatById(to)

            // Anti-ban: Typing simulation
            await chat.sendStateTyping()

            // Anti-ban: Random delay between 3-7 seconds for typing simulation
            const typingTime = Math.floor(Math.random() * 4000) + 3000
            await new Promise(resolve => setTimeout(resolve, typingTime))

            await chat.sendMessage(body)
            win?.webContents.send('wa-message-status', { id: to, status: 'sent', index: i })

            // Anti-ban: Random delay between messages (5-15 seconds)
            if (i < messages.length - 1) {
                const nextDelay = Math.floor(Math.random() * 10000) + 5000
                await new Promise(resolve => setTimeout(resolve, nextDelay))

                // Anti-ban: Batch break every 20 messages
                if ((i + 1) % 20 === 0) {
                    win?.webContents.send('wa-message-status', { status: 'resting', message: 'Mola veriliyor (2 dk)...' })
                    await new Promise(resolve => setTimeout(resolve, 120000))
                }
            }
        } catch (error) {
            console.error('Failed to send message:', error)
            win?.webContents.send('wa-message-status', { id: to, status: 'error', error: error.message, index: i })
        }
    }

    win?.webContents.send('wa-message-status', { status: 'completed' })
})

ipcMain.on('wa-logout', async (event) => {
    log('IPC: wa-logout received')
    if (client) {
        try {
            await client.logout()
            log('Logged out from WhatsApp')
        } catch (error) {
            log('Logout error (ignoring): ' + error.message)
        }

        try {
            await client.destroy()
            log('Client destroyed')
        } catch (error) {
            log('Destroy error: ' + error.message)
        }

        client = null
    }
    win?.webContents.send('wa-logged-out')
})
