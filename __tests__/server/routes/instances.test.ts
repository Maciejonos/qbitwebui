import { describe, it, expect } from 'vitest'
import { instanceToResponse, type InstanceResponse } from '../../../src/server/routes/instances'
import type { Instance } from '../../../src/server/db'

describe('instances routes', () => {
    describe('instanceToResponse', () => {
        it('transforms instance to response', () => {
            const instance: Instance = {
                id: 1,
                user_id: 5,
                label: 'Home',
                url: 'http://localhost:8080',
                qbt_username: 'admin',
                qbt_password_encrypted: 'encrypted',
                skip_auth: 0,
                created_at: 1234567890,
            }

            const response = instanceToResponse(instance)
            expect(response.id).toBe(1)
            expect(response.label).toBe('Home')
            expect(response.skip_auth).toBe(false)
            expect((response as unknown as Record<string, unknown>).user_id).toBeUndefined()
            expect((response as unknown as Record<string, unknown>).qbt_password_encrypted).toBeUndefined()
        })

        it('converts skip_auth number to boolean', () => {
            const instance: Instance = {
                id: 1,
                user_id: 1,
                label: 'Test',
                url: 'http://test',
                qbt_username: null,
                qbt_password_encrypted: null,
                skip_auth: 1,
                created_at: 0,
            }
            expect(instanceToResponse(instance).skip_auth).toBe(true)
        })

        it('handles null credentials', () => {
            const instance: Instance = {
                id: 1,
                user_id: 1,
                label: 'No Auth',
                url: 'http://test',
                qbt_username: null,
                qbt_password_encrypted: null,
                skip_auth: 1,
                created_at: 0,
            }
            const response = instanceToResponse(instance)
            expect(response.qbt_username).toBeNull()
            expect(response.skip_auth).toBe(true)
        })
    })
})
