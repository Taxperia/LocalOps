import { app } from 'electron'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

export function isTrustedRendererUrl(url: string): boolean {
  const developmentUrl = app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL']
  const trusted = developmentUrl || pathToFileURL(path.join(__dirname, '../renderer/index.html')).href
  // Exact document match; ignore only a client-side fragment.
  return url.split('#')[0] === trusted.split('#')[0]
}
