import { useState, type ReactNode } from 'react'
import { PaginationContext } from './paginationContext'

export function PaginationProvider({ children }: { children: ReactNode }) {
	const [page, setPage] = useState(1)
	const [perPage, setPerPage] = useState(() => {
		const stored = localStorage.getItem('torrentsPerPage')
		return stored ? parseInt(stored, 10) : 50
	})
	const [totalItems, setTotalItems] = useState(0)

	const totalPages = Math.max(1, Math.ceil(totalItems / perPage))

	function handleSetPerPage(value: number) {
		setPerPage(value)
		setPage(1)
		localStorage.setItem('torrentsPerPage', value.toString())
	}

	return (
		<PaginationContext.Provider
			value={{
				page,
				perPage,
				totalItems,
				setPage,
				setPerPage: handleSetPerPage,
				setTotalItems,
				totalPages,
			}}
		>
			{children}
		</PaginationContext.Provider>
	)
}
