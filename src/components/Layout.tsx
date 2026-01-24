import type { ReactNode } from 'react'
import { Header } from './Header'
import { StatusBar } from './StatusBar'

type Tab = 'dashboard' | 'tools'

interface Props {
	children: ReactNode
	onTabChange?: (tab: Tab) => void
	username?: string
	authDisabled?: boolean
	onLogout?: () => void
	onPasswordChange?: () => void
}

export function Layout({ children, onTabChange, username, authDisabled, onLogout, onPasswordChange }: Props) {
	return (
		<div className="flex flex-col h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
			<Header
				activeTab={null}
				onTabChange={onTabChange}
				username={username}
				authDisabled={authDisabled}
				onLogout={onLogout}
				onPasswordChange={onPasswordChange}
			/>
			<main className="flex-1 overflow-hidden flex flex-col">{children}</main>
			<StatusBar />
		</div>
	)
}
