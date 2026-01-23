import { createPortal } from 'react-dom'

export interface SpeedtestResult {
    download: number
    upload: number
    ping: number
    server: {
        name: string
        country: string
        sponsor: string
    }
    timestamp: string
}

export type SpeedtestStatus = 'idle' | 'running' | 'done' | 'error'

interface SpeedtestModalProps {
    status: SpeedtestStatus
    result: SpeedtestResult | null
    error: string | null
    onStart: () => void
    onClose: () => void
}

export function SpeedtestModal({ status, result, error, onStart, onClose }: SpeedtestModalProps) {
    const formatSpeed = (bps: number) => {
        const mbps = bps / 1_000_000
        return mbps.toFixed(2)
    }

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="relative w-full max-w-md mx-4 opacity-0 animate-in">
                <div
                    className="absolute -inset-px rounded-2xl"
                    style={{
                        background: 'linear-gradient(to bottom, color-mix(in srgb, var(--accent) 20%, transparent), transparent)',
                    }}
                />
                <div
                    className="relative rounded-2xl border"
                    style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center gap-3">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)' }}
                            >
                                <svg
                                    className="w-5 h-5"
                                    style={{ color: 'var(--accent)' }}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M5.636 19.364a9 9 0 1 1 12.728 0M16 9l-4 4"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Network Speedtest
                            </h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg transition-colors hover:opacity-80"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5 space-y-4">
                        {status === 'idle' && (
                            <div className="text-center space-y-4">
                                <p className="text-xs" style={{ color: 'var(--warning)', opacity: 0.7 }}>
                                    Warning: This tests the container in which qbitwebui is running, not your local network, seedbox, or torrent client unless they are on the same network.
                                </p>
                                <button
                                    onClick={onStart}
                                    className="w-full py-3 rounded-xl font-medium transition-all"
                                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
                                >
                                    Start Speedtest
                                </button>
                            </div>
                        )}

                        {status === 'running' && (
                            <div className="text-center space-y-4 py-6">
                                <div className="relative w-16 h-16 mx-auto">
                                    <div
                                        className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin"
                                        style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
                                    />
                                </div>
                                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                                    Running speedtest...
                                </p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    This may take 30-60 seconds
                                </p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                                    You can close this modal - the test will continue in the background
                                </p>
                            </div>
                        )}

                        {status === 'done' && result && (
                            <div className="space-y-4">
                                {/* Speed Results */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div
                                        className="p-4 rounded-xl border text-center"
                                        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
                                    >
                                        <svg
                                            className="w-4 h-4 mx-auto mb-2"
                                            style={{ color: 'var(--accent)' }}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                        </svg>
                                        <p className="text-xl font-bold font-mono" style={{ color: 'var(--accent)' }}>
                                            {formatSpeed(result.download)}
                                        </p>
                                        <p className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                            Mbps Down
                                        </p>
                                    </div>
                                    <div
                                        className="p-4 rounded-xl border text-center"
                                        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
                                    >
                                        <svg
                                            className="w-4 h-4 mx-auto mb-2"
                                            style={{ color: 'var(--warning)' }}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                        </svg>
                                        <p className="text-xl font-bold font-mono" style={{ color: 'var(--warning)' }}>
                                            {formatSpeed(result.upload)}
                                        </p>
                                        <p className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                            Mbps Up
                                        </p>
                                    </div>
                                </div>

                                {/* Ping & Server */}
                                <div
                                    className="p-3 rounded-xl border space-y-2"
                                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                            Ping
                                        </span>
                                        <span className="font-mono text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                            {result.ping.toFixed(1)} ms
                                        </span>
                                    </div>
                                    {result.server?.sponsor && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                Server
                                            </span>
                                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                {result.server.sponsor}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={onStart}
                                    className="w-full py-2.5 rounded-xl font-medium transition-all border text-sm"
                                    style={{
                                        borderColor: 'var(--border)',
                                        color: 'var(--text-muted)',
                                        backgroundColor: 'var(--bg-secondary)',
                                    }}
                                >
                                    Run Again
                                </button>
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="text-center space-y-4 py-4">
                                <div
                                    className="w-12 h-12 mx-auto rounded-full flex items-center justify-center"
                                    style={{ backgroundColor: 'color-mix(in srgb, var(--error) 20%, transparent)' }}
                                >
                                    <svg
                                        className="w-6 h-6"
                                        style={{ color: 'var(--error)' }}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </div>
                                <p className="text-sm font-medium" style={{ color: 'var(--error)' }}>
                                    Speedtest Failed
                                </p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    {error || 'An unknown error occurred'}
                                </p>
                                <button
                                    onClick={onStart}
                                    className="px-4 py-2 rounded-lg font-medium transition-all"
                                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
                                >
                                    Try Again
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
