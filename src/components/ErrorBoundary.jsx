import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null, errorInfo: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true }
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error', error, errorInfo)
        this.setState({ error, errorInfo })
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null })
        window.location.reload()
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f0f0f] text-white p-6">
                    <div className="glass-card max-w-md w-full p-8 text-center border border-red-500/30 shadow-2xl shadow-red-900/20 rounded-2xl bg-white/5 backdrop-blur-lg">
                        <div className="mx-auto bg-red-500/20 w-16 h-16 rounded-full flex items-center justify-center mb-6">
                            <AlertTriangle size={32} className="text-red-500" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Ters Giden Bir Şeyler Var</h1>
                        <p className="text-gray-400 mb-6 text-sm">
                            Beklenmedik bir hata oluştu. Sayfayı yenilemek genellikle sorunu çözer.
                        </p>

                        <div className="bg-black/40 rounded-lg p-4 mb-6 text-left overflow-auto max-h-40 text-xs text-red-300 font-mono border border-red-500/10">
                            {this.state.error && this.state.error.toString()}
                            <br />
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </div>

                        <button
                            onClick={this.handleReset}
                            className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={18} />
                            Uygulamayı Yenile
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary
