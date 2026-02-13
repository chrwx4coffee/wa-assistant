const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    // WhatsApp Events
    onQRReceived: (callback) => {
        const subscription = (event, qr) => callback(qr)
        ipcRenderer.on('wa-qr', subscription)
        return () => ipcRenderer.removeListener('wa-qr', subscription)
    },
    onReady: (callback) => {
        const subscription = (event) => callback()
        ipcRenderer.on('wa-ready', subscription)
        return () => ipcRenderer.removeListener('wa-ready', subscription)
    },
    onAuthenticated: (callback) => {
        const subscription = (event) => callback()
        ipcRenderer.on('wa-authenticated', subscription)
        return () => ipcRenderer.removeListener('wa-authenticated', subscription)
    },
    onAuthFailure: (callback) => {
        const subscription = (event, message) => callback(message)
        ipcRenderer.on('wa-auth-failure', subscription)
        return () => ipcRenderer.removeListener('wa-auth-failure', subscription)
    },
    onLoadingScreen: (callback) => {
        const subscription = (event, { percent, message }) => callback({ percent, message })
        ipcRenderer.on('wa-loading-screen', subscription)
        return () => ipcRenderer.removeListener('wa-loading-screen', subscription)
    },
    onContactsFetched: (callback) => {
        const subscription = (event, contacts) => callback(contacts)
        ipcRenderer.on('wa-contacts', subscription)
        return () => ipcRenderer.removeListener('wa-contacts', subscription)
    },
    onMessageStatus: (callback) => {
        const subscription = (event, status) => callback(status)
        ipcRenderer.on('wa-message-status', subscription)
        return () => ipcRenderer.removeListener('wa-message-status', subscription)
    },

    // Actions
    initializeWhatsApp: () => ipcRenderer.send('wa-initialize'),
    getContacts: () => ipcRenderer.send('wa-get-contacts'),
    sendBulkMessages: (payload) => ipcRenderer.send('wa-send-bulk', payload),
    logout: () => ipcRenderer.send('wa-logout'),
    onLoggedOut: (callback) => {
        const subscription = () => callback()
        ipcRenderer.on('wa-logged-out', subscription)
        return () => ipcRenderer.removeListener('wa-logged-out', subscription)
    }
})
