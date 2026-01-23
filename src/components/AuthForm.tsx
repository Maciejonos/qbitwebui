import { useState, useEffect } from 'react'
import { Download } from 'lucide-react'
import { register, login, type User } from '../api/auth'

interface Props {
	onSuccess: (user: User) => void
}

export function AuthForm({ onSuccess }: Props) {
	const [mode, setMode] = useState<'login' | 'register'>('login')
	const [registrationDisabled, setRegistrationDisabled] = useState<boolean | null>(null)

	useEffect(() => {
		fetch('/api/config')
			.then((r) => r.json())
			.then((c) => setRegistrationDisabled(c.registrationDisabled ?? false))
			.catch(() => setRegistrationDisabled(true))
	}, [])
	const [username, setUsername] = useState('')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		setError('')

		if (mode === 'register' && password !== confirmPassword) {
			setError('Passwords do not match')
			return
		}

		setLoading(true)
		try {
			const user = mode === 'register' ? await register(username, password) : await login(username, password)
			onSuccess(user)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Operation failed')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div
			className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
			style={{ backgroundColor: 'var(--bg-primary)' }}
		>
			<div
				className="absolute inset-0"
				style={{
					background:
						'radial-gradient(ellipse at top, color-mix(in srgb, var(--accent) 8%, var(--bg-primary)), var(--bg-primary))',
				}}
			/>
			<div
				className="absolute top-1/4 -left-32 w-96 h-96 rounded-full blur-3xl"
				style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 5%, transparent)' }}
			/>

			<form onSubmit={handleSubmit} className="relative w-full max-w-sm opacity-0 animate-in">
				<div
					className="absolute -inset-px rounded-2xl"
					style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, white 8%, transparent), transparent)' }}
				/>
				<div
					className="relative backdrop-blur-xl rounded-2xl p-8 border"
					style={{
						backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 80%, transparent)',
						borderColor: 'var(--border)',
					}}
				>
					<div className="flex items-center gap-3 mb-8">
						<div
							className="w-10 h-10 rounded-xl flex items-center justify-center"
							style={{
								background:
									'linear-gradient(to bottom right, var(--accent), color-mix(in srgb, var(--accent) 70%, black))',
							}}
						>
							<Download className="w-5 h-5" style={{ color: 'var(--accent-contrast)' }} strokeWidth={2.5} />
						</div>
						<div>
							<h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
								qbitwebui
							</h1>
						</div>
					</div>

					{registrationDisabled === false && (
						<div className="flex mb-6 rounded-lg p-1" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
							<button
								type="button"
								onClick={() => {
									setMode('login')
									setError('')
								}}
								className="flex-1 py-2 text-sm font-medium rounded-md transition-colors"
								style={{
									backgroundColor: mode === 'login' ? 'var(--bg-secondary)' : 'transparent',
									color: mode === 'login' ? 'var(--text-primary)' : 'var(--text-muted)',
								}}
							>
								Sign In
							</button>
							<button
								type="button"
								onClick={() => {
									setMode('register')
									setError('')
								}}
								className="flex-1 py-2 text-sm font-medium rounded-md transition-colors"
								style={{
									backgroundColor: mode === 'register' ? 'var(--bg-secondary)' : 'transparent',
									color: mode === 'register' ? 'var(--text-primary)' : 'var(--text-muted)',
								}}
							>
								Register
							</button>
						</div>
					)}

					{error && (
						<div
							className="mb-6 px-4 py-3 rounded-lg text-sm font-medium"
							style={{ backgroundColor: 'color-mix(in srgb, var(--error) 10%, transparent)', color: 'var(--error)' }}
						>
							{error}
						</div>
					)}

					<div className="space-y-4">
						<div>
							<label
								className="block text-xs font-medium mb-2 uppercase tracking-wider"
								style={{ color: 'var(--text-muted)' }}
							>
								Username
							</label>
							<input
								type="text"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								className="w-full px-4 py-3 rounded-lg border text-sm font-mono transition-all"
								style={{
									backgroundColor: 'var(--bg-secondary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
								placeholder="username"
								autoComplete="username"
								required
							/>
						</div>

						<div>
							<label
								className="block text-xs font-medium mb-2 uppercase tracking-wider"
								style={{ color: 'var(--text-muted)' }}
							>
								Password
							</label>
							<input
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="w-full px-4 py-3 rounded-lg border text-sm font-mono transition-all"
								style={{
									backgroundColor: 'var(--bg-secondary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
								placeholder="••••••••"
								autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
								required
							/>
						</div>

						{mode === 'register' && (
							<div>
								<label
									className="block text-xs font-medium mb-2 uppercase tracking-wider"
									style={{ color: 'var(--text-muted)' }}
								>
									Confirm Password
								</label>
								<input
									type="password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									className="w-full px-4 py-3 rounded-lg border text-sm font-mono transition-all"
									style={{
										backgroundColor: 'var(--bg-secondary)',
										borderColor: 'var(--border)',
										color: 'var(--text-primary)',
									}}
									placeholder="••••••••"
									autoComplete="new-password"
									required
								/>
							</div>
						)}
					</div>

					<button
						type="submit"
						disabled={loading}
						className="relative w-full mt-6 py-3 rounded-lg font-medium text-sm transition-all overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
						style={{
							background: 'linear-gradient(to right, var(--accent), color-mix(in srgb, var(--accent) 80%, black))',
						}}
					>
						<span className="relative font-semibold" style={{ color: 'var(--accent-contrast)' }}>
							{loading ? 'Please wait...' : mode === 'register' ? 'Create Account' : 'Sign In'}
						</span>
					</button>

					<p className="mt-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
						{mode === 'register' && registrationDisabled === false
							? 'Create an account to manage your instances'
							: registrationDisabled
								? 'Registration is disabled. Contact administrator for access.'
								: 'Sign in to manage your qBittorrent instances'}
					</p>
				</div>
			</form>
		</div>
	)
}
