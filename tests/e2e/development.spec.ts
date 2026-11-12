import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test'
import type { ViteDevServer } from 'vite'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { tr } from '../../src/renderer/src/i18n/tr'

let server: ViteDevServer
let application: ElectronApplication
let page: Page
let serverUrl: string

test.beforeAll(async () => {
  const { createServer } = await import('vite')
  const { loadConfigFromFile } = await import('electron-vite')
  const loaded = await loadConfigFromFile({ command: 'serve', mode: 'development' }, path.resolve('electron.vite.config.ts'))
  server = await createServer({
    ...loaded!.config.renderer,
    configFile: false,
    root: path.resolve('src/renderer'),
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, strictPort: true }
  })
  await server.listen()
  serverUrl = server.resolvedUrls!.local[0].replace(/\/$/, '')
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'localops-dev-qa-'))
  await fs.mkdir(path.join(scratch, 'data'))
  const bootstrap = path.join(scratch, 'bootstrap.cjs')
  await fs.writeFile(bootstrap, `const { app } = require('electron'); app.setPath('userData', ${JSON.stringify(path.join(scratch, 'data'))}); require(${JSON.stringify(path.resolve('out/main/index.js'))});`)
  application = await electron.launch({ args: [bootstrap], env: { ...process.env, ELECTRON_RENDERER_URL: serverUrl }, chromiumSandbox: true, timeout: 60_000 })
  page = await application.firstWindow()
  await expect(page.getByRole('navigation')).toBeVisible()
})

test.afterAll(async () => {
  await application?.close()
  await server?.close()
})

test('accepts Chromium-canonicalized development URLs and returns actual system data', async () => {
  expect(page.url()).toBe(serverUrl + '/')
  const info = await page.evaluate(() => window.localops.getAppInfo())
  expect(info.platform).toBe('win32')
  const result = await page.evaluate(async () => {
    const [connections, services, system, health] = await Promise.all([
      window.localops.getNetworkConnections(), window.localops.getServices(),
      window.localops.getStaticSystemInfo(), window.localops.getHealth()
    ])
    return { connections: connections.connections.length, services: services.length, cpu: system.cpu.name, memory: system.memory.totalBytes, disks: health.disks.length }
  })
  expect(result.connections).toBeGreaterThan(0)
  expect(result.services).toBeGreaterThan(0)
  expect(result.cpu).toBeTruthy()
  expect(result.memory).toBeGreaterThan(0)
  console.log('Development system data:', result)
})

test('loads performance charts and network rows instead of remaining in loading or empty states', async () => {
  await page.getByRole('navigation').getByRole('button', { name: tr['nav.performance'], exact: true }).click()
  await expect(page.locator('main .recharts-wrapper').first()).toBeVisible()
  const history = await page.evaluate(() => window.localops.getMetricsHistory())
  expect(history.points.length).toBeGreaterThan(0)
  expect(Number.isFinite(history.points.at(-1)!.cpu)).toBe(true)
  await page.getByRole('navigation').getByRole('button', { name: tr['nav.network'], exact: true }).click()
  await expect(page.getByText(tr['netconn.empty'], { exact: true })).toHaveCount(0)
  await expect(page.locator('main').getByText('TCP', { exact: true }).first()).toBeVisible()
  await page.screenshot({ path: 'test-results/development-network.png' })
  await page.getByRole('navigation').getByRole('button', { name: tr['nav.health'], exact: true }).click()
  const health = await page.evaluate(() => window.localops.getHealth())
  if (health.disks.length) await expect(page.locator('main').getByText(health.disks[0].model, { exact: true }).first()).toBeVisible()
})
