import { describe, it, expect } from 'vitest'
import { integrationToResponse, type IntegrationResponse } from '../../../src/server/routes/integrations'
import type { Integration } from '../../../src/server/db'

describe('integrations routes', () => {
    describe('integrationToResponse', () => {
        it('transforms integration to response', () => {
            const integration: Integration = {
                id: 1,
                user_id: 5,
                type: 'prowlarr',
                label: 'My Prowlarr',
                url: 'http://localhost:9696',
                api_key_encrypted: 'encrypted:key',
                created_at: 1234567890,
            }

            const response = integrationToResponse(integration)
            expect(response.id).toBe(1)
            expect(response.type).toBe('prowlarr')
            expect(response.label).toBe('My Prowlarr')
            expect(response.url).toBe('http://localhost:9696')
            expect(response.created_at).toBe(1234567890)
            expect((response as unknown as Record<string, unknown>).user_id).toBeUndefined()
            expect((response as unknown as Record<string, unknown>).api_key_encrypted).toBeUndefined()
        })

        it('does not leak sensitive data', () => {
            const integration: Integration = {
                id: 2,
                user_id: 10,
                type: 'prowlarr',
                label: 'Another',
                url: 'http://192.168.1.100:9696',
                api_key_encrypted: 'very-secret-encrypted-key',
                created_at: 0,
            }

            const response = integrationToResponse(integration)
            const responseObj = response as unknown as Record<string, unknown>

            // Ensure sensitive fields are not present
            expect(responseObj.user_id).toBeUndefined()
            expect(responseObj.api_key_encrypted).toBeUndefined()
            expect(responseObj.api_key).toBeUndefined()
        })
    })
})
