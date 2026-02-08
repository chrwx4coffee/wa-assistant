const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    // WhatsApp Events
    onQRReceived: (callback) => ipcRenderer.on('wa-qr', (event, qr) => callback(qr)),
    onReady: (callback) => ipcRenderer.on('wa-ready', (event) => callback()),
    onAuthenticated: (callback) => ipcRenderer.on('wa-authenticated', (event) => callback()),
    onAuthFailure: (callback) => ipcRenderer.on('wa-auth-failure', (event, message) => callback(message)),
    onLoadingScreen: (callback) => ipcRenderer.on('wa-loading-screen', (event, { percent, message }) => callback({ percent, message })),
    onContactsFetched: (callback) => ipcRenderer.on('wa-contacts', (event, contacts) => callback(contacts)),
    onMessageStatus: (callback) => ipcRenderer.on('wa-message-status', (event, status) => callback(status)),

    // Actions
    initializeWhatsApp: () => ipcRenderer.send('wa-initialize'),
    getContacts: () => ipcRenderer.send('wa-get-contacts'),
    sendBulkMessages: (payload) => ipcRenderer.send('wa-send-bulk', payload),
    logout: () => ipcRenderer.send('wa-logout'),
    onLoggedOut: (callback) => ipcRenderer.on('wa-logged-out', () => callback())
})
