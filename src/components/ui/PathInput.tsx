import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathHistory } from '../../hooks/usePathHistory'

interface PathInputProps {
	value: string
	onChange: (value: string) => void
	onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
	placeholder?: string
	className?: string
	style?: React.CSSProperties
	autoFocus?: boolean
	disabled?: boolean
	inputRef?: React.Ref<HTMLInputElement>
	onTouchEnd?: (e: React.TouchEvent<HTMLInputElement>) => void
}

export function PathInput({
	value,
	onChange,
	onKeyDown,
	placeholder,
	className,
	style,
	autoFocus,
	disabled,
	inputRef,
	onTouchEnd,
}: PathInputProps) {
	const [showSuggestions, setShowSuggestions] = useState(false)
	const [selectedIndex, setSelectedIndex] = useState(-1)
	const { getSuggestions } = usePathHistory()
	const suggestions = getSuggestions(value)
	const containerRef = useRef<HTMLDivElement>(null)
	const internalRef = useRef<HTMLInputElement>(null)
	const listRef = useRef<HTMLUListElement>(null)

	const resolvedRef = (inputRef ?? internalRef) as React.RefObject<HTMLInputElement>

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setShowSuggestions(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	useEffect(() => {
		if (selectedIndex >= 0 && listRef.current) {
			const item = listRef.current.children[selectedIndex] as HTMLElement
			item?.scrollIntoView({ block: 'nearest' })
		}
	}, [selectedIndex])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (showSuggestions && suggestions.length > 0) {
				if (e.key === 'ArrowDown') {
					e.preventDefault()
					setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
					return
				}
				if (e.key === 'ArrowUp') {
					e.preventDefault()
					setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
					return
				}
				if (e.key === 'Enter' && selectedIndex >= 0) {
					e.preventDefault()
					onChange(suggestions[selectedIndex])
					setShowSuggestions(false)
					return
				}
				if (e.key === 'Escape') {
					setShowSuggestions(false)
					return
				}
			}
			onKeyDown?.(e)
		},
		[showSuggestions, suggestions, selectedIndex, onChange, onKeyDown]
	)

	function handleSelect(path: string) {
		onChange(path)
		setShowSuggestions(false)
		resolvedRef.current?.focus()
	}

	const hasSuggestions = suggestions.length > 0

	return (
		<div ref={containerRef} className="relative">
			<input
				ref={resolvedRef as React.RefObject<HTMLInputElement>}
				type="text"
				value={value}
				onChange={(e) => {
					onChange(e.target.value)
					setSelectedIndex(-1)
					setShowSuggestions(true)
				}}
				onFocus={() => setShowSuggestions(true)}
				onKeyDown={handleKeyDown}
				onTouchEnd={onTouchEnd}
				placeholder={placeholder}
				className={className}
				style={style}
				autoFocus={autoFocus}
				disabled={disabled}
			/>
			{showSuggestions && hasSuggestions && (
				<ul
					ref={listRef}
					className="absolute left-0 right-0 z-[300] max-h-40 overflow-y-auto rounded-lg border shadow-lg"
					style={{
						top: '100%',
						marginTop: '2px',
						backgroundColor: 'var(--bg-tertiary)',
						borderColor: 'var(--border)',
					}}
				>
					{suggestions.map((path: string, i: number) => (
						<li
							key={path}
							onMouseDown={(e) => {
								e.preventDefault()
								handleSelect(path)
							}}
							className="px-3 py-1.5 text-xs cursor-pointer truncate"
							style={{
								color: 'var(--text-primary)',
								backgroundColor: i === selectedIndex ? 'var(--bg-hover)' : undefined,
							}}
							onMouseEnter={() => setSelectedIndex(i)}
						>
							{path}
						</li>
					))}
				</ul>
			)}
		</div>
	)
}



