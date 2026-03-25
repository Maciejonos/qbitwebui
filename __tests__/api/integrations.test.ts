import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    getIntegrations,
    createIntegration,
    deleteIntegration,
    testIntegrationConnection,
    getIndexers,
    search,
    grabRelease,
} from '../../src/api/integrations'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('integrations API', () => {
    beforeEach(() => {
        mockFetch.mockReset()
    })

    describe('getIntegrations', () => {
        it('fetches integrations list', async () => {
            const mockIntegrations = [
                { id: 1, type: 'prowlarr', label: 'My Prowlarr', url: 'http://localhost:9696', created_at: 123456 },
            ]
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockIntegrations),
            })

            const result = await getIntegrations()

            expect(mockFetch).toHaveBeenCalledWith('/api/integrations', { credentials: 'include' })
            expect(result).toEqual(mockIntegrations)
        })

        it('throws on failure', async () => {
            mockFetch.mockResolvedValueOnce({ ok: false })

            await expect(getIntegrations()).rejects.toThrow('Failed to fetch integrations')
        })
    })

    describe('createIntegration', () => {
        it('creates integration with data', async () => {
            const createData = {
                type: 'prowlarr',
                label: 'My Prowlarr',
                url: 'http://localhost:9696',
                api_key: 'secret123',
            }
            const mockResult = { id: 1, ...createData, created_at: 123456 }
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResult),
            })

            const result = await createIntegration(createData)

            expect(mockFetch).toHaveBeenCalledWith('/api/integrations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(createData),
            })
            expect(result.id).toBe(1)
        })

        it('throws error with message from server', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({ error: 'Invalid API key' }),
            })

            await expect(createIntegration({
                type: 'prowlarr',
                label: 'Test',
                url: 'http://test',
                api_key: 'invalid',
            })).rejects.toThrow('Invalid API key')
        })
    })

    describe('deleteIntegration', () => {
        it('deletes integration by id', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true })

            await deleteIntegration(5)

            expect(mockFetch).toHaveBeenCalledWith('/api/integrations/5', {
                method: 'DELETE',
                credentials: 'include',
            })
        })

        it('throws on failure', async () => {
            mockFetch.mockResolvedValueOnce({ ok: false })

            await expect(deleteIntegration(999)).rejects.toThrow('Failed to delete integration')
        })
    })

    describe('testIntegrationConnection', () => {
        it('returns success with version', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true, version: '1.0.0' }),
            })

            const result = await testIntegrationConnection('http://localhost:9696', 'apikey123')

            expect(mockFetch).toHaveBeenCalledWith('/api/integrations/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ url: 'http://localhost:9696', api_key: 'apikey123' }),
            })
            expect(result.success).toBe(true)
            expect(result.version).toBe('1.0.0')
        })

        it('returns failure with error', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: false, error: 'Connection refused' }),
            })

            const result = await testIntegrationConnection('http://invalid', 'apikey')

            expect(result.success).toBe(false)
            expect(result.error).toBe('Connection refused')
        })
    })

    describe('getIndexers', () => {
        it('fetches indexers for integration', async () => {
            const mockIndexers = [
                { id: 1, name: 'Indexer 1', enable: true, protocol: 'torrent' },
                { id: 2, name: 'Indexer 2', enable: false, protocol: 'usenet' },
            ]
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockIndexers),
            })

            const result = await getIndexers(1)

            expect(mockFetch).toHaveBeenCalledWith('/api/integrations/1/indexers', { credentials: 'include' })
            expect(result).toHaveLength(2)
        })

        it('throws on failure', async () => {
            mockFetch.mockResolvedValueOnce({ ok: false })

            await expect(getIndexers(1)).rejects.toThrow('Failed to fetch indexers')
        })
    })

    describe('search', () => {
        it('searches with query only', async () => {
            const mockResults = [
                { guid: '123', indexerId: 1, indexer: 'Test', title: 'Result', size: 1000, publishDate: '2024-01-01', categories: [] },
            ]
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResults),
            })

            const result = await search(1, 'test query')

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/integrations/1/search?query=test+query'),
                expect.anything()
            )
            expect(result).toEqual(mockResults)
        })

        it('searches with options', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve([]),
            })

            await search(1, 'test', { indexerIds: '1,2', categories: '5000', type: 'movie' })

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('indexerIds=1%2C2'),
                expect.anything()
            )
        })

        it('throws error with message from server', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({ error: 'Rate limited' }),
            })

            await expect(search(1, 'test')).rejects.toThrow('Rate limited')
        })
    })

    describe('grabRelease', () => {
        it('grabs release with download URL', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true })

            await grabRelease(1, {
                guid: 'abc123',
                indexerId: 1,
                downloadUrl: 'http://example.com/download',
            }, 5, { savepath: '/downloads/complete', downloadPath: '/downloads/incomplete' })

            expect(mockFetch).toHaveBeenCalledWith('/api/integrations/1/grab', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: expect.stringMatching(/"instanceId":5.*"savepath":"\/downloads\/complete".*"downloadPath":"\/downloads\/incomplete"|"instanceId":5.*"downloadPath":"\/downloads\/incomplete".*"savepath":"\/downloads\/complete"/),
            })
        })

        it('grabs release with magnet URL', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true })

            await grabRelease(1, {
                guid: 'abc123',
                indexerId: 1,
                magnetUrl: 'magnet:?xt=urn:btih:abc123',
            }, 5)

            expect(mockFetch).toHaveBeenCalled()
        })

        it('throws error on failure', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({ error: 'Indexer offline' }),
            })

            await expect(grabRelease(1, { guid: '123', indexerId: 1 }, 5))
                .rejects.toThrow('Indexer offline')
        })
    })
})
