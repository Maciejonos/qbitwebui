import { describe, it, expect } from 'vitest'
import { sanitizeFilename } from '../../../src/server/routes/files'

describe('files routes', () => {
    describe('sanitizeFilename', () => {
        it('sanitizes quotes', () => {
            expect(sanitizeFilename('file"name')).toBe('file_name')
        })

        it('sanitizes newlines', () => {
            expect(sanitizeFilename('file\nname')).toBe('file_name')
        })

        it('sanitizes carriage returns', () => {
            expect(sanitizeFilename('file\rname')).toBe('file_name')
        })

        it('leaves safe characters unchanged', () => {
            expect(sanitizeFilename('Movie (2024) [1080p].mkv')).toBe('Movie (2024) [1080p].mkv')
        })

        it('handles multiple special characters', () => {
            expect(sanitizeFilename('file"with\r\nnewlines')).toBe('file_with__newlines')
        })
    })
})
