import { useState, useEffect, useCallback } from 'react'

interface SpeedtestResult {
    id: string
    timestamp: number
    download: number
    upload: number
    ping: number
    server: {
        name: string
        country: string
        sponsor: string
    }
}

interface Props {
    onBack: () => void
}

const STORAGE_KEY = 'speedtest_history'
const MAX_HISTORY = 10

function loadHistory(): SpeedtestResult[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        return stored ? JSON.parse(stored) : []
    } catch {
        return []
    }
}

function saveHistory(history: SpeedtestResult[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
}

export function MobileSpeedtest({ onBack }: Props) {
    const [history, setHistory] = useState<SpeedtestResult[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        setHistory(loadHistory())
    }, [])

    const runSpeedtest = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/tools/speedtest', {
                method: 'POST',
                credentials: 'include',
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Speedtest failed')
            }

            const data = await res.json()
            const result: SpeedtestResult = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                timestamp: Date.now(),
                download: data.download,
                upload: data.upload,
                ping: data.ping,
                server: data.server,
            }

            const newHistory = [result, ...history].slice(0, MAX_HISTORY)
            setHistory(newHistory)
            saveHistory(newHistory)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
        } finally {
            setLoading(false)
        }
    }, [history])

    const clearHistory = () => {
        setHistory([])
        localStorage.removeItem(STORAGE_KEY)
    }

    const formatSpeed = (bps: number) => (bps / 1_000_000).toFixed(2)
    const formatTime = (ts: number) => new Date(ts).toLocaleTimeString()
    const formatDate = (ts: number) => new Date(ts).toLocaleDateString()

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div
                className="flex items-center gap-3 px-4 py-3 border-b"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
            >
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 rounded-xl active:scale-95 transition-transform"
                    style={{ color: 'var(--text-muted)' }}
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Network Speedtest
                    </h1>
                    {loading && (
                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
                            Running...
                        </span>
                    )}
                </div>
                {history.length > 0 && (
                    <button
                        onClick={clearHistory}
                        disabled={loading}
                        className="p-2 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                        style={{ color: 'var(--text-muted)' }}
                        title="Clear history"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Run Button */}
            <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <button
                    onClick={runSpeedtest}
                    disabled={loading}
                    className="w-full py-4 rounded-2xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
                >
                    {loading ? (
                        <>
                            <div
                                className="w-5 h-5 border-2 rounded-full animate-spin"
                                style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
                            />
                            Running Speedtest...
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 19.364a9 9 0 1 1 12.728 0M16 9l-4 4" />
                            </svg>
                            Start Speedtest
                        </>
                    )}
                </button>
                {loading && (
                    <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                        Active torrents will be paused during the test
                    </p>
                )}
                {error && (
                    <p className="text-xs text-center mt-2" style={{ color: 'var(--error)' }}>
                        {error}
                    </p>
                )}
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-auto">
                {history.length === 0 && !loading ? (
                    <div className="text-center py-16">
                        <svg
                            className="w-12 h-12 mx-auto mb-3"
                            style={{ color: 'var(--text-muted)' }}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                        </svg>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            No speedtests yet
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            Run a test to check your server's bandwidth
                        </p>
                    </div>
                ) : (
                    <div>
                        {history.map((result, idx) => {
                            const prevResult = history[idx - 1]
                            const showDate = !prevResult || formatDate(result.timestamp) !== formatDate(prevResult.timestamp)

                            return (
                                <div key={result.id}>
                                    {showDate && (
                                        <div
                                            className="px-4 py-2 text-xs font-medium sticky top-0"
                                            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                                        >
                                            {formatDate(result.timestamp)}
                                        </div>
                                    )}
                                    <div
                                        className="px-4 py-4 border-b"
                                        style={{ borderColor: 'color-mix(in srgb, var(--border) 50%, transparent)' }}
                                    >
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                                {formatTime(result.timestamp)}
                                            </span>
                                            {result.server?.sponsor && (
                                                <span
                                                    className="px-2 py-0.5 rounded text-xs font-medium truncate max-w-[180px]"
                                                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                                                >
                                                    {result.server.sponsor}
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="text-center">
                                                <svg
                                                    className="w-4 h-4 mx-auto mb-1"
                                                    style={{ color: 'var(--accent)' }}
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                                </svg>
                                                <p className="text-lg font-bold font-mono" style={{ color: 'var(--accent)' }}>
                                                    {formatSpeed(result.download)}
                                                </p>
                                                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                                    Mbps Down
                                                </p>
                                            </div>
                                            <div className="text-center">
                                                <svg
                                                    className="w-4 h-4 mx-auto mb-1"
                                                    style={{ color: 'var(--warning)' }}
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                                </svg>
                                                <p className="text-lg font-bold font-mono" style={{ color: 'var(--warning)' }}>
                                                    {formatSpeed(result.upload)}
                                                </p>
                                                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                                    Mbps Up
                                                </p>
                                            </div>
                                            <div className="text-center">
                                                <svg
                                                    className="w-4 h-4 mx-auto mb-1"
                                                    style={{ color: 'var(--text-muted)' }}
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
                                                </svg>
                                                <p className="text-lg font-bold font-mono" style={{ color: 'var(--text-secondary)' }}>
                                                    {result.ping.toFixed(0)}
                                                </p>
                                                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                                    ms Ping
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            {history.length > 0 && (
                <div
                    className="px-4 py-2 text-xs border-t flex items-center justify-between"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                    <span>{history.length} test{history.length !== 1 ? 's' : ''}</span>
                    <span>Last {MAX_HISTORY} kept</span>
                </div>
            )}
        </div>
    )
}
