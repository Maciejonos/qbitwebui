import { useMemo, type ReactNode } from 'react'
import type { Instance } from '../api/instances'
import { InstanceContext } from './instanceContext'

interface Props {
	instance: Instance
	children: ReactNode
}

export function InstanceProvider({ instance, children }: Props) {
	const value = useMemo(() => ({ instance }), [instance])
	return <InstanceContext.Provider value={value}>{children}</InstanceContext.Provider>
}
