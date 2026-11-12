import { afterEach, describe, expect, it, vi } from 'vitest'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const { runtime } = vi.hoisted(() => ({ runtime: { isPackaged: true } }))
vi.mock('electron', () => ({ app: runtime }))
import { isTrustedRendererUrl } from '../src/main/ipc/security'

describe('IPC document boundary', () => {
  afterEach(() => { runtime.isPackaged = true; vi.unstubAllEnvs() })
  const localUrl = pathToFileURL(path.resolve('src/main/renderer/index.html')).href
  it('accepts the canonical trailing slash added by Chromium to the development URL', () => {
    runtime.isPackaged = false
    vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5174')
    expect(isTrustedRendererUrl('http://localhost:5174/')).toBe(true)
    expect(isTrustedRendererUrl('http://localhost:5174/#performance')).toBe(true)
  })
  it('keeps the development origin, port and document boundary enforced', () => {
    runtime.isPackaged = false
    vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5174')
    for (const url of ['http://localhost:5175/', 'http://localhost:5174/other', 'http://localhost:5174/?injected=1', 'http://localhost.evil:5174/', 'not a URL']) {
      expect(isTrustedRendererUrl(url)).toBe(false)
    }
  })
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
