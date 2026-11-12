import { app } from 'electron'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

export function isTrustedRendererUrl(url: string): boolean {
  const developmentUrl = app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL']
  const trusted = developmentUrl || pathToFileURL(path.join(__dirname, '../renderer/index.html')).href
  try {
    // Chromium canonicalizes a bare origin to origin + '/'. Compare parsed
    // document URLs so the dev server is accepted without trusting other pages.
    const actualDocument = new URL(url)
    const trustedDocument = new URL(trusted)
    actualDocument.hash = trustedDocument.hash = ''
    return actualDocument.href === trustedDocument.href
  } catch {
    return false
  }
}
