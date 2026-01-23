import type { ReactNode } from 'react'

function renderInline(text: string): ReactNode[] {
	const nodes: ReactNode[] = []
	const pattern = /(\[([^\]]+)\]\(([^)]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g
	let lastIndex = 0
	let match: RegExpExecArray | null

	while ((match = pattern.exec(text)) !== null) {
		if (match.index > lastIndex) {
			nodes.push(text.slice(lastIndex, match.index))
		}

		if (match[2] && match[3]) {
			const label = match[2]
			const url = match[3]
			if (/^https?:\/\//i.test(url)) {
				nodes.push(
					<a
						key={`link-${match.index}`}
						href={url}
						target="_blank"
						rel="noreferrer"
						className="underline underline-offset-2"
						style={{ color: 'var(--accent)' }}
					>
						{label}
					</a>
				)
			} else {
				nodes.push(`${label} (${url})`)
			}
		} else if (match[5]) {
			nodes.push(
				<code
					key={`code-${match.index}`}
					className="px-1 py-0.5 rounded"
					style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
				>
					{match[5]}
				</code>
			)
		} else if (match[7]) {
			nodes.push(
				<strong key={`bold-${match.index}`} style={{ color: 'var(--text-primary)' }}>
					{match[7]}
				</strong>
			)
		} else if (match[9]) {
			nodes.push(
				<em key={`em-${match.index}`} style={{ color: 'var(--text-secondary)' }}>
					{match[9]}
				</em>
			)
		}

		lastIndex = match.index + match[0].length
	}

	if (lastIndex < text.length) {
		nodes.push(text.slice(lastIndex))
	}

	return nodes
}

export function renderMarkdown(markdown: string): ReactNode[] {
	const lines = markdown.replace(/\r\n/g, '\n').split('\n')
	const nodes: ReactNode[] = []
	let listItems: string[] = []
	let inCodeBlock = false
	let codeLines: string[] = []

	const flushList = () => {
		if (listItems.length === 0) return
		const items = listItems
		listItems = []
		nodes.push(
			<ul key={`list-${nodes.length}`} className="list-disc pl-4 space-y-1">
				{items.map((item, idx) => (
					<li key={`li-${idx}`} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
						{renderInline(item)}
					</li>
				))}
			</ul>
		)
	}

	const flushCode = () => {
		if (codeLines.length === 0) return
		const code = codeLines.join('\n')
		codeLines = []
		nodes.push(
			<pre
				key={`code-${nodes.length}`}
				className="text-xs whitespace-pre-wrap rounded-lg p-2"
				style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
			>
				<code>{code}</code>
			</pre>
		)
	}

	for (const rawLine of lines) {
		const line = rawLine.trimEnd()
		if (line.startsWith('```')) {
			if (inCodeBlock) {
				flushCode()
				inCodeBlock = false
			} else {
				flushList()
				inCodeBlock = true
			}
			continue
		}

		if (inCodeBlock) {
			codeLines.push(rawLine)
			continue
		}

		if (line.trim().length === 0) {
			flushList()
			continue
		}

		const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line)
		if (headingMatch) {
			flushList()
			nodes.push(
				<div
					key={`heading-${nodes.length}`}
					className="text-xs font-semibold uppercase tracking-wide"
					style={{ color: 'var(--text-muted)' }}
				>
					{renderInline(headingMatch[2])}
				</div>
			)
			continue
		}

		const listMatch = /^[-*+]\s+(.*)$/.exec(line)
		if (listMatch) {
			listItems.push(listMatch[1])
			continue
		}

		flushList()
		nodes.push(
			<p key={`p-${nodes.length}`} className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
				{renderInline(line)}
			</p>
		)
	}

	if (inCodeBlock) {
		flushCode()
	}
	flushList()

	return nodes
}
