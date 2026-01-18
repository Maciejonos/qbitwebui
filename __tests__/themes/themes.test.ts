import { describe, it, expect } from 'vitest'
import { themes, getThemeById } from '../../src/themes/index'

describe('themes', () => {
    describe('themes array', () => {
        it('contains expected theme count', () => {
            expect(themes.length).toBeGreaterThanOrEqual(5)
        })

        it('has default theme first', () => {
            expect(themes[0].id).toBe('default')
        })

        it('all themes have required properties', () => {
            for (const theme of themes) {
                expect(theme.id).toBeTruthy()
                expect(theme.name).toBeTruthy()
                expect(theme.colors).toBeDefined()
                expect(theme.colors.bgPrimary).toBeTruthy()
                expect(theme.colors.bgSecondary).toBeTruthy()
                expect(theme.colors.textPrimary).toBeTruthy()
                expect(theme.colors.accent).toBeTruthy()
                expect(theme.colors.error).toBeTruthy()
                expect(theme.colors.warning).toBeTruthy()
            }
        })

        it('all colors are valid hex codes', () => {
            const hexPattern = /^#[0-9A-Fa-f]{6}$/

            for (const theme of themes) {
                for (const [key, value] of Object.entries(theme.colors)) {
                    expect(value, `${theme.id}.colors.${key}`).toMatch(hexPattern)
                }
            }
        })

        it('has unique theme IDs', () => {
            const ids = themes.map(t => t.id)
            const uniqueIds = new Set(ids)
            expect(uniqueIds.size).toBe(ids.length)
        })

        it('has unique theme names', () => {
            const names = themes.map(t => t.name)
            const uniqueNames = new Set(names)
            expect(uniqueNames.size).toBe(names.length)
        })
    })

    describe('individual themes', () => {
        it('default (Midnight) theme has correct structure', () => {
            const midnight = themes.find(t => t.id === 'default')
            expect(midnight).toBeDefined()
            expect(midnight?.name).toBe('Midnight')
            expect(midnight?.colors.accent).toBe('#00d4aa')
        })

        it('catppuccin theme exists', () => {
            const catppuccin = themes.find(t => t.id === 'catppuccin')
            expect(catppuccin).toBeDefined()
            expect(catppuccin?.name).toBe('Catppuccin')
        })

        it('dracula theme exists', () => {
            const dracula = themes.find(t => t.id === 'dracula')
            expect(dracula).toBeDefined()
            expect(dracula?.colors.accent).toBe('#bd93f9')
        })

        it('nord theme exists', () => {
            const nord = themes.find(t => t.id === 'nord')
            expect(nord).toBeDefined()
        })

        it('gruvbox theme exists', () => {
            const gruvbox = themes.find(t => t.id === 'gruvbox')
            expect(gruvbox).toBeDefined()
        })

        it('everforest theme exists', () => {
            const everforest = themes.find(t => t.id === 'everforest')
            expect(everforest).toBeDefined()
        })
    })

    describe('getThemeById', () => {
        it('returns correct theme for valid ID', () => {
            const theme = getThemeById('catppuccin')
            expect(theme.id).toBe('catppuccin')
            expect(theme.name).toBe('Catppuccin')
        })

        it('returns default theme for unknown ID', () => {
            const theme = getThemeById('nonexistent')
            expect(theme).toEqual(themes[0])
            expect(theme.id).toBe('default')
        })

        it('returns default theme for empty string', () => {
            const theme = getThemeById('')
            expect(theme.id).toBe('default')
        })

        it('returns theme with all color properties', () => {
            const theme = getThemeById('nord')
            expect(theme.colors.bgPrimary).toBeDefined()
            expect(theme.colors.bgSecondary).toBeDefined()
            expect(theme.colors.bgTertiary).toBeDefined()
            expect(theme.colors.textPrimary).toBeDefined()
            expect(theme.colors.textSecondary).toBeDefined()
            expect(theme.colors.textMuted).toBeDefined()
            expect(theme.colors.accent).toBeDefined()
            expect(theme.colors.accentContrast).toBeDefined()
            expect(theme.colors.warning).toBeDefined()
            expect(theme.colors.error).toBeDefined()
            expect(theme.colors.border).toBeDefined()
            expect(theme.colors.progress).toBeDefined()
        })
    })

    describe('theme color accessibility', () => {
        it('text colors are light on dark backgrounds', () => {
            for (const theme of themes) {
                // Primary text should be light (high value)
                const textPrimary = parseInt(theme.colors.textPrimary.slice(1, 3), 16)
                expect(textPrimary, `${theme.id} textPrimary should be light`).toBeGreaterThan(150)

                // Primary background should be dark (low value)
                const bgPrimary = parseInt(theme.colors.bgPrimary.slice(1, 3), 16)
                expect(bgPrimary, `${theme.id} bgPrimary should be dark`).toBeLessThan(80)
            }
        })
    })
})
