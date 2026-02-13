import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileSpreadsheet,
  MessageSquare,
  Users,
  Send,
  CheckCircle,
  Loader2,
  ArrowRight,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  QrCode,
  Search,
  Check,
  X,
  AlertCircle,
  Plus,
  ListOrdered,
  ArrowRightLeft,
  LogOut
} from 'lucide-react'
import * as XLSX from 'xlsx'
import './App.css'

const ChevronButton = ({ up, onClick, disabled }) => (
  <div
    className={`chevron-btn ${disabled ? 'disabled' : ''}`}
    onClick={!disabled ? onClick : undefined}
  >
    {up ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
  </div>
)

const SCREENS = {
  START: 'START',
  WA_LOGIN: 'WA_LOGIN',
  WA_LOADING: 'WA_LOADING',
  CONTACT_SELECT: 'CONTACT_SELECT',
  COMPOSE: 'COMPOSE',
  SENDING: 'SENDING',
  SUCCESS: 'SUCCESS'
}

function App() {
  const [screen, setScreen] = useState(SCREENS.START)
  const [mode, setMode] = useState(null) // 'EXCEL' or 'WEB'
  const [qrCode, setQrCode] = useState(null)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [contacts, setContacts] = useState([])
  const [selectedContacts, setSelectedContacts] = useState([])
  const [excelData, setExcelData] = useState(null)
  const [template, setTemplate] = useState('')
  const [sendStatus, setSendStatus] = useState([]) // Array of status objects
  const [isDone, setIsDone] = useState(false)
  const [filterType, setFilterType] = useState('ALL') // 'ALL', 'MY_CONTACTS', 'GROUPS'
  const [searchQuery, setSearchQuery] = useState('')
  const [unmatchedRows, setUnmatchedRows] = useState([])
  const [showIssues, setShowIssues] = useState(false)
  const [matchMode, setMatchMode] = useState('AUTO')
  const [manualLinks, setManualLinks] = useState({}) // { contactId: rowIndex }


  const [toast, setToast] = useState(null) // { message, type }

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
  }

  useEffect(() => {
    // Listen to Electron events
    const cleanups = []

    if (window.electronAPI) {
      cleanups.push(window.electronAPI.onQRReceived((url) => {
        setQrCode(url)
        setScreen(SCREENS.WA_LOGIN)
      }))

      cleanups.push(window.electronAPI.onReady(() => {
        setScreen(SCREENS.WA_LOADING)
        setLoadingMsg('Sohbetler yükleniyor...')
        window.electronAPI.getContacts()
      }))

      cleanups.push(window.electronAPI.onAuthFailure((message) => {
        setScreen(SCREENS.START)
        showToast('Hata: ' + message, 'error')
      }))

      cleanups.push(window.electronAPI.onLoadingScreen(({ percent, message }) => {
        setLoadingMsg(`${message} (${percent}%)`)
      }))

      cleanups.push(window.electronAPI.onContactsFetched((fetchedContacts) => {
        setContacts(fetchedContacts)
        // Always switch to contact select screen when data arrives
        setScreen(SCREENS.CONTACT_SELECT)
      }))

      cleanups.push(window.electronAPI.onMessageStatus((status) => {
        if (status.status === 'completed') {
          setIsDone(true)
        } else if (status.status === 'resting') {
          setSendStatus(prev => [...prev, { type: 'info', message: status.message }])
        } else {
          setSendStatus(prev => [...prev, status])
        }
      }))

      cleanups.push(window.electronAPI.onLoggedOut(() => {
        setScreen(SCREENS.START)
        setContacts([])
        showToast('Başarıyla çıkış yapıldı.', 'success')
      }))
    }

    return () => {
      cleanups.forEach(cleanup => cleanup && cleanup())
    }
  }, [])

  // AUTO-MATCH SIDE EFFECT
  useEffect(() => {
    // Only run if we are in EXCEL mode, have data, contacts are loaded, AND we haven't matched yet (selected is empty)
    // Actually, we want to run if excelData changes. 
    // We cleared selectedContacts in handleStartExcel.
    if (mode === 'EXCEL' && excelData && excelData.length > 0 && contacts.length > 0) {
      console.log('Running Auto-Match...')

      const rawHeaders = excelHeaders.length > 0 ? excelHeaders : Object.keys(excelData[0])
      // Auto-detect phone column
      const pCol = excelHeaders.find(h => {
        const lower = h.toLowerCase()
        return lower.includes('tel') || lower.includes('no') || lower.includes('numara') || lower.includes('phone')
      })

      if (!pCol) {
        showToast('Excel dosyasında "Telefon", "Tel" veya "Numara" sütunu bulunamadı. Lütfen "Web" veya "Excel" modunda manuel seçim yapın.', 'error')
        setLoadingMsg('Numara sütunu bulunamadı.')
        setScreen(SCREENS.CONTACT_SELECT) // Go to contact select without matching
        return // CRITICAL: Stop execution to prevent iterating with undefined column
      }

      setPhoneCol(pCol)

      const newSelected = []
      const newUnmatched = []
      let debugFirstRow = ''

      excelData.forEach((row, idx) => {
        const rowNum = normalizeNumber(row[pCol])
        // Strict minimal length check (e.g. 7 digits)
        if (!rowNum || rowNum.length < 5) {
          newUnmatched.push({ row, index: idx, reason: 'Geçersiz/Boş Numara', phoneNumber: rowNum })
          return
        }
        if (idx === 0) debugFirstRow = rowNum

        // Robust Matching: Use endsWith and exclude groups to avoid accidental ID matches
        const contact = contacts.find(c => {
          if (c.isGroup) return false
          const cNum = normalizeNumber(c.number)
          // Match via suffix overlap (e.g. 555123 matches 90555123)
          return (cNum.length > 6 && rowNum.length > 6 && (cNum.endsWith(rowNum) || rowNum.endsWith(cNum)))
        })

        if (contact) {
          // Check missing data
          const missingCols = []
          excelHeaders.forEach(h => { // Use excelHeaders from state
            if (row[h] === undefined || row[h] === '' || row[h] === null) missingCols.push(h)
          })

          const enhancedContact = { ...contact, _excelMissing: missingCols, _excelRowIdx: idx }
          newSelected.push(enhancedContact)
        } else {
          newUnmatched.push({ row, index: idx, reason: 'Rehberde Bulunamadı', phoneNumber: rowNum })
        }
      })

      // Update state
      setSelectedContacts(newSelected)
      setUnmatchedRows(newUnmatched)
      setShowIssues(newUnmatched.length > 0)

      if (newSelected.length > 0) {
        setMatchMode('AUTO')
        showToast(`Eşleşme Tamamlandı\n✅ ${newSelected.length} Kişi Eşleşti\n⚠️ ${newUnmatched.length} Hata`, 'success')
        setScreen(SCREENS.CONTACT_SELECT)
      } else {
        showToast(`Eşleşme Başarısız.\nİlk Numara: ${debugFirstRow}`, 'error')
        setScreen(SCREENS.CONTACT_SELECT)
      }
    }
  }, [mode, excelData, contacts]) // Run when ANY of these change

  const handleLogout = () => {
    if (window.confirm('Hesaptan çıkış yapmak istediğinize emin misiniz?')) {
      window.electronAPI?.logout()
    }
  }

  const handleStartWeb = () => {
    if (!window.electronAPI) {
      showToast('Hata: Electron API bulunamadı. Lütfen uygulamayı web tarayıcısı üzerinden değil, kendi penceresi üzerinden kullanın.', 'error')
      return
    }
    setMode('WEB')
    setScreen(SCREENS.WA_LOADING)
    setLoadingMsg('WhatsApp başlatılıyor...')
    window.electronAPI.initializeWhatsApp()
  }

  const handleStartExcel = () => {
    if (!window.electronAPI) {
      alert('Hata: Electron API bulunamadı. Lütfen uygulamayı web tarayıcısı üzerinden değil, kendi penceresi üzerinden kullanın.')
      return
    }
    setMode('EXCEL')
    setSelectedContacts([]) // Reset
    setUnmatchedRows([])
    setShowIssues(false)
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx, .xls'
    input.onchange = (e) => {
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.onload = (evt) => {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws) // Objects

        if (data.length > 0) {
          const headers = Object.keys(data[0])
          setExcelHeaders(headers)
          setExcelData(data)
          setComposeExcelData(data) // Sync for compose screen
          // Initialize WhatsApp AFTER data is ready
          setScreen(SCREENS.WA_LOADING)

          setLoadingMsg('WhatsApp başlatılıyor...')
          window.electronAPI.initializeWhatsApp()
        } else {
          alert('Excel dosyası boş veya okunamadı.')
        }
      }
      reader.readAsBinaryString(file)
    }
    input.click()
  }

  /* Excel Logic */
  const [excelHeaders, setExcelHeaders] = useState([])
  const [composeExcelData, setComposeExcelData] = useState(null) // Object Array
  const [phoneCol, setPhoneCol] = useState(null)

  const handleComposeImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx, .xls'
    input.onchange = (e) => {
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.onload = (evt) => {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws) // Objects with header keys

        if (data.length > 0) {
          const headers = Object.keys(data[0])
          setExcelHeaders(headers)
          setComposeExcelData(data)

          // Try to auto-detect phone column
          const pCol = headers.find(h => {
            const lower = h.toLowerCase()
            return lower.includes('tel') || lower.includes('no') || lower.includes('numara') || lower.includes('phone')
          })
          if (pCol) {
            setPhoneCol(pCol)
            setMatchMode('AUTO')
            showToast(`Eşleşme Sütunu: ${pCol}`, 'success')
          } else {
            setPhoneCol(null)
            setMatchMode('SEQUENTIAL') // No phone column -> Sequential Mode
            showToast('Numara sütunu bulunamadı. "Sıralı Eşleştirme" modu aktif.', 'info')
          }
        }
      }
      reader.readAsBinaryString(file)
    }
    input.click()
  }

  const normalizeNumber = (num) => {
    if (!num) return ''
    return String(num).replace(/\D/g, '')
  }

  const findMatchingRow = (contact) => {
    if (!composeExcelData) return null

    // 1. Check Manual Link
    if (manualLinks[contact.id] !== undefined) {
      return composeExcelData[manualLinks[contact.id]]
    }

    // 2. Auto Match
    if (!phoneCol) return null
    const contactNum = normalizeNumber(contact.number)

    return composeExcelData.find(row => {
      const rowNum = normalizeNumber(row[phoneCol])
      return (rowNum.length > 5 && contactNum.endsWith(rowNum)) ||
        (contactNum.length > 5 && rowNum.endsWith(contactNum))
    })
  }

  const resolveTemplate = (tmpl, contact, index) => {
    let body = tmpl.replace(/{isim}/g, contact.name)

    if (composeExcelData) {
      let row = null
      if (matchMode === 'SEQUENTIAL' && typeof index === 'number') {
        row = composeExcelData[index]
      } else {
        row = findMatchingRow(contact)
      }

      if (row) {
        excelHeaders.forEach(header => {
          const val = row[header] !== undefined ? row[header] : ''
          body = body.split(`{${header}}`).join(val)
        })
      }
    }
    return body
  }

  const toggleContact = (contact) => {
    setSelectedContacts(prev => {
      const exists = prev.find(c => c.id === contact.id)
      if (exists) return prev.filter(c => c.id !== contact.id)
      return [...prev, contact]
    })
  }

  const moveContact = (index, direction) => {
    if (direction === 'up' && index > 0) {
      const newContacts = [...selectedContacts]
      const temp = newContacts[index]
      newContacts[index] = newContacts[index - 1]
      newContacts[index - 1] = temp
      setSelectedContacts(newContacts)
    }
    if (direction === 'down' && index < selectedContacts.length - 1) {
      const newContacts = [...selectedContacts]
      const temp = newContacts[index]
      newContacts[index] = newContacts[index + 1]
      newContacts[index + 1] = temp
      setSelectedContacts(newContacts)
    }
  }

  const filteredContacts = contacts.filter(c => {
    // 1. Text Search
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.number && c.number.includes(searchQuery))

    if (!matchesSearch) return false

    // 2. Type Filter
    if (filterType === 'MY_CONTACTS') return c.isMyContact
    if (filterType === 'GROUPS') return c.isGroup

    return true
  })

  const handleSelectAll = () => {
    // Select all filtered contacts that are not already selected
    const toAdd = filteredContacts.filter(fc => !selectedContacts.find(sc => sc.id === fc.id))
    setSelectedContacts(prev => [...prev, ...toAdd])
  }

  const handleDeselectAll = () => {
    // Remove all filtered contacts from selection
    const idsToRemove = new Set(filteredContacts.map(fc => fc.id))
    setSelectedContacts(prev => prev.filter(sc => !idsToRemove.has(sc.id)))
  }

  const handleSend = () => {
    const messages = selectedContacts.map((c, index) => {
      const body = resolveTemplate(template, c, index)
      return { to: c.id, body }
    })

    setScreen(SCREENS.SENDING)
    window.electronAPI.sendBulkMessages({ messages })
  }

  // Manual Match Logic
  const [fixingRowIndex, setFixingRowIndex] = useState(null)
  const [fixSearch, setFixSearch] = useState('')
  // Sequential Sort Modal State
  const [showSortModal, setShowSortModal] = useState(false)

  const handleManualMatch = (contact) => {
    if (fixingRowIndex === null) return

    // 1. Update Excel Data to have this contact's number (so auto-match works)
    const newData = [...composeExcelData]
    const row = newData[fixingRowIndex]
    if (phoneCol && row) {
      row[phoneCol] = contact.number // Update number to match contact
    }
    setComposeExcelData(newData)

    // 2. Add to Selected Contacts
    toggleContact(contact) // This handles adding if not present

    // 3. Remove from Unmatched
    setUnmatchedRows(prev => prev.filter(r => r.index !== fixingRowIndex))

    // 4. Close Modal
    setFixingRowIndex(null)
    setFixSearch('')
  }

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {/* Toast Notification */}
      <div className="toast-container">
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`toast ${toast.type}`}
            >
              <div className={`toast-icon`}>
                {toast.type === 'success' ? <CheckCircle size={16} /> :
                  toast.type === 'error' ? <AlertCircle size={16} /> : <Loader2 size={16} />}
              </div>
              <div className="toast-content">
                <div className="toast-title">{toast.type === 'error' ? 'Hata' : toast.type === 'success' ? 'Başarılı' : 'Bilgi'}</div>
                <div className="toast-msg">{toast.message}</div>
              </div>
              <div className="toast-close" onClick={() => setToast(null)}>
                <X size={14} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>


      <AnimatePresence mode="wait">
        {screen === SCREENS.START && (
          <motion.div
            key="start"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="screen start-screen"
          >
            <div className="logo-container">
              <MessageSquare size={64} color="var(--primary)" />
              <h1>WhatsApp Asistanı</h1>
              <p>Hızlı, Güvenli ve Kişiselleştirilmiş Mesaj Gönderimi</p>
            </div>

            <div className="options">
              <div className="option-card glass-card" onClick={handleStartExcel}>
                <FileSpreadsheet size={40} />
                <h3>Excel'den Kişi Seç</h3>
                <p>Numaraları Excel dosyasından içe aktarın ve eşleştirin.</p>
                <div className="badge">Önerilen</div>
              </div>

              <div className="option-card glass-card" onClick={handleStartWeb}>
                <Users size={40} />
                <h3>Web'den Kişi Seç</h3>
                <p>Mevcut sohbetlerinizden veya gruplarınızdan alıcı seçin.</p>
              </div>
            </div>
          </motion.div>
        )}

        {screen === SCREENS.WA_LOGIN && (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="screen login-screen"
          >
            <div className="glass-card qr-container text-center">
              <QrCode size={48} className="mx-auto mb-4" color="var(--primary)" />
              <h2>Giriş Yapın</h2>
              <p>WhatsApp'tan QR kodu taratarak oturum açın.</p>
              <div className="qr-wrapper">
                <img src={qrCode} alt="QR Code" />
              </div>
              <div className="tip">
                <Loader2 size={16} className="animate-spin" />
                <span>Oturum açmanız bekleniyor...</span>
              </div>
            </div>
          </motion.div>
        )}

        {screen === SCREENS.WA_LOADING && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="screen loading-screen"
          >
            <div className="text-center">
              <Loader2 size={64} className="animate-spin mb-4" color="var(--primary)" />
              <h2>{loadingMsg}</h2>
              <p>Lütfen bekleyin, sistem hazırlanıyor.</p>
            </div>
          </motion.div>
        )}

        {screen === SCREENS.CONTACT_SELECT && (
          <motion.div
            key="contacts"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="screen contact-screen"
          >
            <div className="contact-layout">
              {/* MAIN CONTENT */}
              <div className="contact-main">
                <header className="flex justify-between items-center mb-4">
                  <div>
                    <h2>Alıcı Seçimi</h2>
                    <p className="text-dim text-sm">{contacts.length} numara bulundu</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="icon-btn danger"
                      onClick={handleLogout}
                      title="Çıkış Yap"
                    >
                      <LogOut size={18} />
                    </button>
                    <button
                      className="secondary text-sm"
                      onClick={handleSelectAll}
                    >
                      Tümünü Seç
                    </button>
                    <button
                      className="secondary text-sm"
                      onClick={handleDeselectAll}
                    >
                      Seçimi Kaldır
                    </button>
                  </div>
                </header>

                <div className="filter-tabs">
                  <button
                    className={`filter-tab ${filterType === 'ALL' ? 'active' : ''}`}
                    onClick={() => setFilterType('ALL')}
                  >
                    Tümü
                  </button>
                  <button
                    className={`filter-tab ${filterType === 'MY_CONTACTS' ? 'active' : ''}`}
                    onClick={() => setFilterType('MY_CONTACTS')}
                  >
                    Kişilerim
                  </button>
                  <button
                    className={`filter-tab ${filterType === 'GROUPS' ? 'active' : ''}`}
                    onClick={() => setFilterType('GROUPS')}
                  >
                    Gruplar
                  </button>
                </div>

                <div className="search-bar mb-4 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" size={18} />
                  <input
                    type="text"
                    placeholder="Kişi veya numara ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-glass border border-white/10 rounded-lg outline-none focus:border-primary/50"
                  />
                  {searchQuery && (
                    <X
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dim cursor-pointer hover:text-white"
                      size={18}
                      onClick={() => setSearchQuery('')}
                    />
                  )}
                </div>

                <div className="contact-list glass-card overflow-y-auto flex-1">
                  {filteredContacts.length > 0 ? (
                    filteredContacts.map(contact => (
                      <div
                        key={contact.id}
                        className={`contact-item ${selectedContacts.find(c => c.id === contact.id) ? 'selected' : ''}`}
                        onClick={() => toggleContact(contact)}
                      >
                        <div className="avatar">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="contact-info">
                          <h4>{contact.name}</h4>
                          <p>{contact.isGroup ? (contact.isCommunity ? 'Topluluk' : 'Grup') : contact.number}</p>
                        </div>
                        <div className="check">
                          <CheckCircle size={20} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-dim bg-glass rounded-lg border border-white/10">
                      <p>Bu filtrede sonuç bulunamadı.</p>
                    </div>
                  )}
                </div>
                <div className="mt-2 text-dim text-xs">
                  <span>Gösterilen: {filteredContacts.length} / {contacts.length}</span>
                </div>
              </div>

              {/* SIDEBAR FOR COMPOSE */}
              <div className="contact-sidebar">
                <div className="sidebar-header flex-col items-start gap-2 p-4">
                  <div className="flex w-full justify-between items-center">
                    <h3>Seçilenler</h3>
                    <div className="flex gap-2">
                      <span className={`badge ${unmatchedRows.length > 0 ? 'bg-danger' : ''}`}>{selectedContacts.length}</span>
                      {unmatchedRows.length > 0 && (
                        <span className="badge bg-yellow-500 text-black" title="Hatalar">! {unmatchedRows.length}</span>
                      )}
                    </div>
                  </div>

                  {/* TABS (Only in Excel Mode or if issues exist) */}
                  {(mode === 'EXCEL' || unmatchedRows.length > 0) && (
                    <div className="w-full flex bg-glass rounded-lg p-1 gap-1">
                      <button
                        className={`flex-1 text-xs py-1 rounded ${!showIssues ? 'bg-primary text-white' : 'hover:bg-white/10'}`}
                        onClick={() => setShowIssues(false)}
                      >
                        ✅ Eşleşen
                      </button>
                      <button
                        className={`flex-1 text-xs py-1 rounded ${showIssues ? 'bg-yellow-500 text-black' : 'hover:bg-white/10'}`}
                        onClick={() => setShowIssues(true)}
                      >
                        ⚠️ Hatalar
                      </button>
                    </div>
                  )}
                </div>

                <div className="sidebar-content">
                  {showIssues ? (
                    <div className="flex flex-col gap-2">
                      {unmatchedRows.length === 0 && <p className="text-dim text-center text-sm py-4">Hata bulunamadı.</p>}
                      {unmatchedRows.map((issue, idx) => (
                        <div key={idx} className="selected-item border-l-4 border-l-red-500 bg-red-900/10">
                          <div className="info w-full">
                            <div className="flex flex-col w-full">
                              <span className="text-sm font-bold text-red-500">Eşleşmedi</span>
                              <span className="text-xs text-white">{issue.phoneNumber || 'Numara Yok'}</span>
                              <span className="text-xs text-dim italic">{issue.reason}</span>
                              <span className="text-xs text-dim mt-1">Excel Satır: {issue.index + 1}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    selectedContacts.length > 0 ? (
                      selectedContacts.map((contact, idx) => {
                        const hasMissing = contact._excelMissing && contact._excelMissing.length > 0
                        return (
                          <div key={contact.id} className={`selected-item ${hasMissing ? 'border-l-4 border-l-yellow-500 bg-yellow-900/10' : ''}`}>
                            <div className="info">
                              <div className="avatar-small">
                                {contact.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex flex-col overflow-hidden">
                                <div className="name" title={contact.name}>{contact.name}</div>
                                {hasMissing ? (
                                  <span className="text-xs text-yellow-500 font-bold">! Eksik Veri: {contact._excelMissing[0]}</span>
                                ) : (
                                  <span className="text-xs text-dim">{idx + 1}. Sıra</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="remove-btn" onClick={() => toggleContact(contact)}>
                                <X size={14} />
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-center text-dim mt-10">
                        <p className="text-sm">Henüz kişi seçilmedi.</p>
                      </div>
                    )
                  )}
                </div>

                <div className="sidebar-footer">
                  <button
                    className="primary w-full justify-center"
                    disabled={selectedContacts.length === 0}
                    onClick={() => setScreen(SCREENS.COMPOSE)}
                  >
                    Devam Et <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {screen === SCREENS.COMPOSE && (
          <motion.div
            key="compose"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="screen compose-screen"
          >
            <div className="flex flex-col h-full">
              <header className="mb-6 flex justify-between items-center">
                <div>
                  <h2>Mesaj Şablonu</h2>
                  <p>Excel verilerini kullanarak mesajınızı kişiselleştirin.</p>
                </div>
                {mode !== 'EXCEL' && (
                  <button className="secondary" onClick={handleComposeImport}>
                    <FileSpreadsheet size={18} />
                    {composeExcelData ? 'Excel Güncelle' : 'Excel Verisi Yükle'}
                  </button>
                )}
              </header>

              <div className="grid grid-cols-2 gap-6 flex-1 overflow-hidden">
                {/* LEFT COLUMN: Template Editor */}
                <div className="glass-card flex flex-col">
                  <header className="flex justify-between items-center mb-2">
                    <h3>Şablon Düzenleyici</h3>
                    {matchMode === 'SEQUENTIAL' && (
                      <button className="secondary text-xs flex items-center gap-1 bg-blue-500/20 hover:bg-blue-500/40 border-blue-500/30 text-blue-200" onClick={() => setShowSortModal(true)}>
                        <ListOrdered size={14} />
                        Sıralamayı Düzenle
                      </button>
                    )}
                  </header>
                  <p className="text-dim text-xs mb-2">
                    {composeExcelData
                      ? `Yüklendi: ${composeExcelData.length} satır. Eşleşme sütunu: ${phoneCol || 'Bulunamadı'}`
                      : 'Excel yükleyerek {sütun} kullanabilirsiniz. (Zorunlu sütun: "tel" veya "numara")'}
                  </p>

                  <textarea
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    placeholder="Mesajınızı buraya yazın..."
                    className="flex-1 resize-none"
                  />

                  <div className="mt-4 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    <button className="secondary text-sm px-2 py-1" onClick={() => setTemplate(prev => prev + '{isim}')}>{'{isim}'}</button>
                    {excelHeaders.map(h => (
                      <button
                        key={h}
                        className="secondary text-sm px-2 py-1"
                        onClick={() => setTemplate(prev => prev + `{${h}}`)}
                        title={`${h} sütununu ekle`}
                      >
                        {`{${h}}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* RIGHT COLUMN: Preview (Unified for both modes) */}
                <div className="glass-card overflow-y-auto flex flex-col">
                  {matchMode === 'SEQUENTIAL' && composeExcelData ? (
                    <div className="flex flex-col h-full">
                      <h3 className="mb-2 text-sm sticky top-0 bg-[#121212] z-10 py-1 font-bold text-dim">Canlı Sonuçlar ({selectedContacts.length})</h3>
                      <div className="flex-1 overflow-y-auto p-2">
                        {selectedContacts.map((contact, index) => {
                          const body = resolveTemplate(template, contact, index)
                          return (
                            <div key={contact.id} className="preview-bubble mb-4">
                              <div className="flex justify-between items-center mb-1">
                                <small>{contact.name}</small>
                                <span className="text-[10px] text-dim">#{index + 1}</span>
                              </div>
                              <div className="bubble text-sm">
                                {body || <span className="text-dim italic">...</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    /* STANDARD MODE PREVIEW */
                    <div className="h-full flex flex-col">
                      {/* Separate Unmatched Section */}
                      {(() => {
                        const unmatched = selectedContacts.filter(c => composeExcelData && !findMatchingRow(c))
                        const matched = selectedContacts.filter(c => !composeExcelData || findMatchingRow(c))

                        return (
                          <>
                            {unmatched.length > 0 && (
                              <div className="fix-panel">
                                <div className="fix-header">
                                  <span className="fix-title"><AlertCircle size={18} /> Eşleşme Sorunları ({unmatched.length})</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                  {unmatched.map(c => (
                                    <div key={c.id} className="fix-item">
                                      <div className="flex justify-between text-sm mb-2">
                                        <strong>{c.name}</strong>
                                        <span className="text-dim">{c.number}</span>
                                      </div>
                                      <div className="fix-actions">
                                        <input
                                          type="number"
                                          className="row-input"
                                          placeholder="Satır #"
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              const val = parseInt(e.target.value)
                                              if (val > 0 && val <= composeExcelData.length) {
                                                setManualLinks(prev => ({ ...prev, [c.id]: val - 1 }))
                                              }
                                            }
                                          }}
                                        />
                                        <div className="text-xs text-dim px-2">veya</div>
                                        <select
                                          className="flex-1 bg-black/30 border border-white/20 rounded text-xs p-1.5 text-white outline-none focus:border-primary"
                                          onChange={(e) => {
                                            if (e.target.value) {
                                              setManualLinks(prev => ({ ...prev, [c.id]: parseInt(e.target.value) }))
                                            }
                                          }}
                                        >
                                          <option value="">Listeden Seç...</option>
                                          {composeExcelData.map((r, rIdx) => (
                                            <option key={rIdx} value={rIdx}>
                                              {rIdx + 1}. {r[excelHeaders[0]] || r[phoneCol] || 'Veri Yok'}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex justify-between items-center mb-4">
                              <h3>Önizleme</h3>
                              <span className="text-xs text-dim">Gösterilen: {matched.length} Kişi</span>
                            </div>

                            <div className="preview-container">
                              {matched.slice(0, 10).map((c, i) => {
                                const body = resolveTemplate(template, c, i)

                                // Check for missing variables
                                let hasWarning = false
                                if (composeExcelData) {
                                  const row = findMatchingRow(c) // It IS guaranteed to exist here due to filter
                                  if (row) {
                                    excelHeaders.forEach(h => {
                                      if (template.includes(`{${h}}`) && !row[h]) hasWarning = true
                                    })
                                  }
                                }

                                return (
                                  <div key={c.id} className={`preview-bubble mb-4 ${hasWarning ? 'border-l-4 border-yellow-500 pl-2' : ''}`}>
                                    <div className="flex justify-between items-center mb-1">
                                      <small>{c.name} ({c.number}) için:</small>
                                      {hasWarning && <span className="text-yellow-500 text-xs font-bold" title="Eksik Veri">! Eksik Veri</span>}
                                    </div>
                                    <div className="bubble">{body || '...'}</div>
                                  </div>
                                )
                              })}
                              {matched.length > 10 && <p className="text-center text-dim">... ve {matched.length - 10} kişi daha</p>}
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  )}
                </div>

              </div>

              <footer className="mt-6 flex justify-end gap-4">
                <button className="secondary" onClick={() => setScreen(SCREENS.CONTACT_SELECT)}>Geri</button>
                <button className="primary" onClick={handleSend}>
                  Gönderimi Başlat <Send size={18} />
                </button>
              </footer>
            </div>
          </motion.div>
        )}

        {screen === SCREENS.SENDING && (
          <motion.div
            key="sending"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="screen sending-screen"
          >
            <div className="h-full flex flex-col">
              <header className="text-center mb-8">
                <h2 className="flex items-center justify-center gap-3">
                  {!isDone && <Loader2 size={24} className="animate-spin" color="var(--primary)" />}
                  {isDone ? 'Tamamlandı' : 'Gönderiliyor...'}
                </h2>
                <p>{sendStatus.filter(s => s.status === 'sent').length} / {selectedContacts.length} mesaj gönderildi.</p>
              </header>

              <div className="status-log glass-card flex-1 overflow-y-auto">
                {sendStatus.map((s, i) => (
                  <div key={i} className={`log-entry ${s.status || s.type}`}>
                    {s.status === 'sent' && <CheckCircle size={16} color="var(--success)" />}
                    {s.status === 'error' && <AlertCircle size={16} color="var(--danger)" />}
                    {s.type === 'info' && <Loader2 size={16} className="animate-spin" />}
                    <span>{s.status === 'sent' ? `Mesaj gönderildi: ${selectedContacts[s.index]?.name}` : s.message || s.error}</span>
                  </div>
                ))}
              </div>

              {isDone && (
                <footer className="mt-6 flex justify-center">
                  <button className="primary" onClick={() => window.location.reload()}>
                    Yeni İşlem <RefreshCw size={18} />
                  </button>
                </footer>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SEQUENTIAL SORT MODAL */}
      {showSortModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
          <div className="glass-card w-full max-w-4xl h-[85vh] flex flex-col border border-blue-500/30 shadow-2xl shadow-blue-900/20">
            <header className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                  <ListOrdered size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Sıralamayı Düzenle</h2>
                  <p className="text-dim text-sm">Kişileri yukarı/aşağı taşıyarak Excel satırlarıyla eşleştirin.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right mr-4">
                  <div className="text-xs text-dim">Toplam Kişi</div>
                  <div className="font-bold text-lg">{selectedContacts.length}</div>
                </div>
                <button className="primary px-6 py-2 h-auto text-base" onClick={() => setShowSortModal(false)}>
                  <CheckCircle size={18} className="mr-2" />
                  Kaydet ve Tamamla
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto pr-2">
              <div className="grid grid-cols-1 gap-2">
                {selectedContacts.map((contact, index) => {
                  const excelRow = composeExcelData[index]

                  return (
                    <div key={contact.id} className="flex items-center gap-4 bg-white/5 p-3 rounded-lg border border-white/10 hover:bg-white/10 transition-colors group">
                      {/* Reorder Buttons */}
                      <div className="flex flex-col gap-1">
                        <button className="p-1 hover:bg-primary/50 bg-black/40 rounded transition-colors" onClick={() => moveContact(index, 'up')} disabled={index === 0}>
                          <ChevronUp size={18} />
                        </button>
                        <span className="text-center font-bold text-sm text-dim w-8">{index + 1}</span>
                        <button className="p-1 hover:bg-primary/50 bg-black/40 rounded transition-colors" onClick={() => moveContact(index, 'down')} disabled={index === selectedContacts.length - 1}>
                          <ChevronDown size={18} />
                        </button>
                      </div>

                      {/* Contact Card */}
                      <div className="flex-1">
                        <div className="text-xs text-dim mb-1">WhatsApp Kişisi</div>
                        <div className="font-bold text-lg">{contact.name}</div>
                        <div className="text-sm text-dim font-mono">{contact.number}</div>
                      </div>

                      {/* Exchange Icon */}
                      <div className="text-dim opacity-50 group-hover:opacity-100 transition-opacity transform group-hover:scale-110">
                        <ArrowRightLeft size={20} />
                      </div>

                      {/* Excel Card */}
                      <div className={`flex-1 p-3 rounded border ${excelRow ? 'bg-green-900/10 border-green-500/20' : 'bg-red-900/10 border-red-500/20'}`}>
                        <div className={`text-xs mb-1 font-bold ${excelRow ? 'text-green-400' : 'text-red-400'}`}>
                          {excelRow ? `Excel Satır ${index + 1}` : 'Eşleşen Veri Yok'}
                        </div>
                        {excelRow ? (
                          <div className="text-sm opacity-90 break-all">
                            {Object.values(excelRow).join(' | ')}
                          </div>
                        ) : (
                          <div className="text-sm text-red-300 italic">Bu kişi için Excel'de satır kalmadı.</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Match Modal */}
      {fixingRowIndex !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass-card w-full max-w-md flex flex-col max-h-[80vh]">
            <header className="flex justify-between items-center mb-4">
              <h3>Kişi Seç</h3>
              <button className="text-dim hover:text-white" onClick={() => setFixingRowIndex(null)}><X size={20} /></button>
            </header>

            <div className="search-bar mb-4">
              <Search size={18} className="icon" />
              <input
                type="text"
                placeholder="Ara..."
                value={fixSearch}
                onChange={(e) => setFixSearch(e.target.value)}
              />
            </div>

            <div className="overflow-y-auto flex-1 flex flex-col gap-2">
              {contacts
                .filter(c => c.name.toLowerCase().includes(fixSearch.toLowerCase()) || c.number.includes(fixSearch))
                .slice(0, 50)
                .map(c => (
                  <div key={c.id} className="p-3 rounded bg-white/5 hover:bg-white/10 cursor-pointer flex justify-between items-center" onClick={() => handleManualMatch(c)}>
                    <div>
                      <div className="font-bold">{c.name}</div>
                      <div className="text-xs text-dim">{c.number}</div>
                    </div>
                    <Plus size={16} />
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
