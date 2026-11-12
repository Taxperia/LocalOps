import { describe, expect, it, vi } from 'vitest'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const { runtime } = vi.hoisted(() => ({ runtime: { isPackaged: true } }))
vi.mock('electron', () => ({ app: runtime }))
import { isTrustedRendererUrl } from '../src/main/ipc/security'

describe('IPC document boundary', () => {
  const localUrl = pathToFileURL(path.resolve('src/main/renderer/index.html')).href
  it('accepts the application document and a client-side fragment', () => {
    expect(isTrustedRendererUrl(localUrl)).toBe(true)
    expect(isTrustedRendererUrl(localUrl + '#processes')).toBe(true)
  })
  it('rejects remote pages, sibling documents and URL prefix tricks', () => {
    for (const url of ['https://example.com', localUrl + '.evil', localUrl + '?injected=1', localUrl.replace('index.html', 'other.html')]) {
      expect(isTrustedRendererUrl(url)).toBe(false)
    }
  })
  it('ignores a development URL in packaged builds', () => {
    vi.stubEnv('ELECTRON_RENDERER_URL', 'https://example.com/')
    expect(isTrustedRendererUrl('https://example.com/')).toBe(false)
    vi.unstubAllEnvs()
  })
})
