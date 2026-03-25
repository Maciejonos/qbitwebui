import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    getTorrents,
    getTransferInfo,
    getSyncMaindata,
    stopTorrents,
    startTorrents,
    deleteTorrents,
    getCategories,
    getTags,
    createTags,
    deleteTags,
    setCategory,
    addTags,
    removeTags,
    getTorrentProperties,
    getTorrentTrackers,
    getTorrentFiles,
    renameTorrent,
    setTorrentLocation,
    setTorrentDownloadPath,
    addTrackers,
    removeTrackers,
    getPreferences,
    getLog,
    getPeerLog,
    getSpeedLimitsMode,
    toggleSpeedLimitsMode,
    createCategory,
    editCategory,
    removeCategories,
    setFilePriority,
    getRSSItems,
    getRSSRules,
} from '../../src/api/qbittorrent'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('qBittorrent API', () => {
    const instanceId = 1

    beforeEach(() => {
        mockFetch.mockReset()
    })

    // Helper to create successful JSON response
    const jsonResponse = (data: unknown) => ({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(data)),
    })

    describe('getTorrents', () => {
        it('fetches torrents without filters', async () => {
            const mockTorrents = [{ hash: 'abc123', name: 'Test Torrent' }]
            mockFetch.mockResolvedValueOnce(jsonResponse(mockTorrents))

            const result = await getTorrents(instanceId)

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/instances/1/qbt/v2/torrents/info',
                expect.objectContaining({ credentials: 'include' })
            )
            expect(result).toEqual(mockTorrents)
        })

        it('fetches torrents with filter options', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse([]))

            await getTorrents(instanceId, { filter: 'downloading', category: 'movies', tag: 'hd' })

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('filter=downloading'),
                expect.anything()
            )
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('category=movies'),
                expect.anything()
            )
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('tag=hd'),
                expect.anything()
            )
        })

        it('skips filter=all in request', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse([]))

            await getTorrents(instanceId, { filter: 'all' })

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/instances/1/qbt/v2/torrents/info',
                expect.anything()
            )
        })
    })

    describe('getTransferInfo', () => {
        it('fetches transfer info', async () => {
            const mockInfo = { dl_info_speed: 1024, up_info_speed: 512 }
            mockFetch.mockResolvedValueOnce(jsonResponse(mockInfo))

            const result = await getTransferInfo(instanceId)

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/instances/1/qbt/v2/transfer/info',
                expect.anything()
            )
            expect(result).toEqual(mockInfo)
        })
    })

    describe('getSyncMaindata', () => {
        it('fetches sync maindata', async () => {
            const mockData = { rid: 1, torrents: {} }
            mockFetch.mockResolvedValueOnce(jsonResponse(mockData))

            const result = await getSyncMaindata(instanceId)

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/instances/1/qbt/v2/sync/maindata?rid=0',
                expect.anything()
            )
            expect(result).toEqual(mockData)
        })
    })

    describe('torrent actions', () => {
        it('stops torrents', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}))

            await stopTorrents(instanceId, ['hash1', 'hash2'])

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/instances/1/qbt/v2/torrents/stop',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                })
            )
        })

        it('starts torrents', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}))

            await startTorrents(instanceId, ['hash1'])

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/instances/1/qbt/v2/torrents/start',
                expect.anything()
            )
        })

        it('deletes torrents without files', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}))

            await deleteTorrents(instanceId, ['hash1'], false)

            const call = mockFetch.mock.calls[0]
            expect(call[0]).toBe('/api/instances/1/qbt/v2/torrents/delete')
            expect(call[1].body.get('deleteFiles')).toBe('false')
        })

        it('deletes torrents with files', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}))

            await deleteTorrents(instanceId, ['hash1'], true)

            const call = mockFetch.mock.calls[0]
            expect(call[1].body.get('deleteFiles')).toBe('true')
        })

	it('changes torrent save path', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}))

            await setTorrentLocation(instanceId, ['hash1', 'hash2'], '/downloads/new-path')

            const call = mockFetch.mock.calls[0]
            expect(call[0]).toBe('/api/instances/1/qbt/v2/torrents/setLocation')
            expect(call[1].body.get('hashes')).toBe('hash1|hash2')
            expect(call[1].body.get('location')).toBe('/downloads/new-path')
        })

        it('changes torrent download path', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}))

            await setTorrentDownloadPath(instanceId, ['hash1'], '/downloads/incomplete')

            const call = mockFetch.mock.calls[0]
            expect(call[0]).toBe('/api/instances/1/qbt/v2/torrents/setDownloadPath')
            expect(call[1].body.get('hashes')).toBe('hash1')
            expect(call[1].body.get('downloadPath')).toBe('/downloads/incomplete')
        })
    })

    describe('categories', () => {
        it('gets categories', async () => {
            const mockCategories = { movies: { name: 'movies', savePath: '/downloads/movies' } }
            mockFetch.mockResolvedValueOnce(jsonResponse(mockCategories))

            const result = await getCategories(instanceId)

            expect(result).toEqual(mockCategories)
        })

        it('creates category with save path', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}))

            await createCategory(instanceId, 'movies', '/downloads/movies')

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/instances/1/qbt/v2/torrents/createCategory',
                expect.anything()
            )
        })

        it('edits category', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}))

            await editCategory(instanceId, 'movies', '/new/path')

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/instances/1/qbt/v2/torrents/editCategory',
                expect.anything()
            )
        })

        it('removes categories', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}))

            await removeCategories(instanceId, ['movies', 'tv'])

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/instances/1/qbt/v2/torrents/removeCategories',
                expect.anything()
            )
        })

        it('sets category on torrents', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}))

            await setCategory(instanceId, ['hash1', 'hash2'], 'movies')

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/instances/1/qbt/v2/torrents/setCategory',
                expect.anything()
            )
        })
    })

    describe('tags', () => {
        it('gets tags', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse(['tag1', 'tag2']))

            const result = await getTags(instanceId)

            expect(result).toEqual(['tag1', 'tag2'])
        })

        it('creates tags', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}))

            await createTags(instanceId, 'newtag')

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/instances/1/qbt/v2/torrents/createTags',
                expect.anything()
            )
        })

        it('deletes tags', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}))

            await deleteTags(instanceId, 'oldtag')

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/instances/1/qbt/v2/torrents/deleteTags',
                expect.anything()
            )
        })

        it('adds tags to torrents', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}))

            await addTags(instanceId, ['hash1'], 'tag1,tag2')

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/instances/1/qbt/v2/torrents/addTags',
                expect.anything()
            )
        })

        it('removes tags from torrents', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}))

            await removeTags(instanceId, ['hash1'], 'tag1')

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/instances/1/qbt/v2/torrents/removeTags',
                expect.anything()
            )
        })
    })

    describe('torrent details', () => {
        it('gets torrent properties', async () => {
            const mockProps = { save_path: '/downloads', total_size: 1000000 }
            mockFetch.mockResolvedValueOnce(jsonResponse(mockProps))

            const result = await getTorrentProperties(instanceId, 'abc123')

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/instances/1/qbt/v2/torrents/properties?hash=abc123',
                expect.anything()
            )
            expect(result).toEqual(mockProps)
        })

        it('gets torrent trackers', async () => {
            const mockTrackers = [{ url: 'http://tracker.example.com', status: 2 }]
            mockFetch.mockResolvedValueOnce(jsonResponse(mockTrackers))

            const result = await getTorrentTrackers(instanceId, 'abc123')

            expect(result).toEqual(mockTrackers)
        })

        it('gets torrent files', async () => {
            const mockFiles = [{ name: 'file.mkv', size: 1000000 }]
            mockFetch.mockResolvedValueOnce(jsonResponse(mockFiles))

            const result = await getTorrentFiles(instanceId, 'abc123')

            expect(result).toEqual(mockFiles)
        })
    })

    describe('torrent management', () => {
        it('renames torrent', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}))

            await renameTorrent(instanceId, 'abc123', 'New Name')

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/instances/1/qbt/v2/torrents/rename',
                expect.anything()
            )
        })

        it('adds trackers', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}))

            await addTrackers(instanceId, 'abc123', ['http://tracker1.com', 'http://tracker2.com'])

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/instances/1/qbt/v2/torrents/addTrackers',
                expect.anything()
            )
        })

        it('removes trackers', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}))

            await removeTrackers(instanceId, 'abc123', ['http://tracker1.com'])

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/instances/1/qbt/v2/torrents/removeTrackers',
                expect.anything()
            )
        })

        it('sets file priority', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}))

            await setFilePriority(instanceId, 'abc123', [0, 1, 2], 7)

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/instances/1/qbt/v2/torrents/filePrio',
                expect.anything()
            )
        })
    })

    describe('preferences', () => {
        it('gets preferences', async () => {
            const mockPrefs = { save_path: '/downloads', listen_port: 6881 }
            mockFetch.mockResolvedValueOnce(jsonResponse(mockPrefs))

            const result = await getPreferences(instanceId)

            expect(result).toEqual(mockPrefs)
        })
    })

    describe('speed limits', () => {
        it('gets speed limits mode', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('1') })

            const result = await getSpeedLimitsMode(instanceId)

            expect(result).toBe(1)
        })

        it('toggles speed limits mode', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true })

            await toggleSpeedLimitsMode(instanceId)

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/instances/1/qbt/v2/transfer/toggleSpeedLimitsMode',
                expect.objectContaining({ method: 'POST' })
            )
        })
    })

    describe('logs', () => {
        it('gets log entries', async () => {
            const mockLogs = [{ id: 1, message: 'Test log', timestamp: 123456, type: 1 }]
            mockFetch.mockResolvedValueOnce(jsonResponse(mockLogs))

            const result = await getLog(instanceId)

            expect(result).toEqual(mockLogs)
        })

        it('gets log with filter options', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse([]))

            await getLog(instanceId, { normal: true, warning: true, critical: true, lastKnownId: 10 })

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('normal=true'),
                expect.anything()
            )
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('last_known_id=10'),
                expect.anything()
            )
        })

        it('gets peer log', async () => {
            const mockPeerLogs = [{ id: 1, ip: '192.168.1.1', timestamp: 123456, blocked: false, reason: '' }]
            mockFetch.mockResolvedValueOnce(jsonResponse(mockPeerLogs))

            const result = await getPeerLog(instanceId)

            expect(result).toEqual(mockPeerLogs)
        })
    })

    describe('RSS', () => {
        it('gets RSS items', async () => {
            const mockItems = { 'Feed 1': { url: 'http://feed.com/rss' } }
            mockFetch.mockResolvedValueOnce(jsonResponse(mockItems))

            const result = await getRSSItems(instanceId)

            expect(result).toEqual(mockItems)
        })

        it('gets RSS rules', async () => {
            const mockRules = { 'Rule 1': { enabled: true, mustContain: 'test' } }
            mockFetch.mockResolvedValueOnce(jsonResponse(mockRules))

            const result = await getRSSRules(instanceId)

            expect(result).toEqual(mockRules)
        })
    })

    describe('error handling', () => {
        it('throws on non-ok response', async () => {
            mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('Error') })

            await expect(getTorrents(instanceId)).rejects.toThrow('API error: 500')
        })

        it('throws on empty response', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('') })

            await expect(getTorrents(instanceId)).rejects.toThrow('Empty response from API')
        })

        it('throws on invalid JSON', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('not json') })

            await expect(getTorrents(instanceId)).rejects.toThrow('Invalid JSON response')
        })
    })
})
