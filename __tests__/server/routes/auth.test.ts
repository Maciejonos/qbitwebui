import { describe, it, expect } from 'vitest'
import { validatePassword, validateUsername } from '../../../src/server/routes/auth'

describe('auth routes', () => {
    describe('validatePassword', () => {
        it('rejects empty password', () => {
            expect(validatePassword('')).toBe('Password must be at least 8 characters')
        })

        it('rejects short password', () => {
            expect(validatePassword('Short1!')).toBe('Password must be at least 8 characters')
        })

        it('rejects password without lowercase', () => {
            expect(validatePassword('PASSWORD123')).toBe('Password must contain a lowercase letter')
        })

        it('rejects password without uppercase', () => {
            expect(validatePassword('password123')).toBe('Password must contain an uppercase letter')
        })

        it('rejects password without number', () => {
            expect(validatePassword('PasswordABC')).toBe('Password must contain a number')
        })

        it('accepts valid password', () => {
            expect(validatePassword('Password123')).toBeNull()
        })

        it('accepts password with special characters', () => {
            expect(validatePassword('P@ssword123!')).toBeNull()
        })

        it('accepts password exactly 8 characters', () => {
            expect(validatePassword('Pass1234')).toBeNull()
        })
    })

    describe('validateUsername', () => {
        it('rejects empty username', () => {
            expect(validateUsername('')).toBe('Username must be 3-32 characters')
        })

        it('rejects short username', () => {
            expect(validateUsername('ab')).toBe('Username must be 3-32 characters')
        })

        it('rejects long username', () => {
            expect(validateUsername('a'.repeat(33))).toBe('Username must be 3-32 characters')
        })

        it('accepts valid username', () => {
            expect(validateUsername('user')).toBeNull()
            expect(validateUsername('abc')).toBeNull()
            expect(validateUsername('a'.repeat(32))).toBeNull()
        })
    })
})
