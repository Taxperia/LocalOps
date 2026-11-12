import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { tr } from '../../src/renderer/src/i18n/tr'

let application: ElectronApplication
let page: Page
const errors: string[] = []

test.beforeAll(async () => {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'localops-qa-'))
  const bootstrap = path.join(scratch, 'bootstrap.cjs')
  await fs.mkdir(path.join(scratch, 'data'))
  await fs.writeFile(bootstrap, `const { app } = require('electron'); app.setVersion(require(${JSON.stringify(path.resolve('package.json'))}).version); app.setPath('userData', ${JSON.stringify(path.join(scratch, 'data'))}); require(${JSON.stringify(path.resolve('out/main/index.js'))});`)
  application = await electron.launch({ args: [bootstrap], timeout: 60_000, chromiumSandbox: true })
  page = await application.firstWindow()
  page.on('pageerror', (error) => errors.push(error.message))
  await expect(page.getByRole('navigation')).toBeVisible()
})
test.afterAll(async () => { await application?.close() })

test('starts with a sandboxed renderer and one native window control group', async () => {
  await expect(page.locator('h1')).toBeVisible()
  const sandboxed = await application.evaluate(({ app }) => app.getAppMetrics().filter((p) => p.type === 'Tab').map((p) => p.sandboxed))
  expect(sandboxed.length).toBeGreaterThan(0)
  expect(sandboxed.every(Boolean)).toBe(true)
  await expect(page.locator('.titlebar button')).toHaveCount(1)
  expect(await page.evaluate(() => typeof (window as unknown as { require?: unknown }).require)).toBe('undefined')
})

test('keeps the process list visible and usable beside details at the minimum window size', async () => {
  await page.getByRole('navigation').getByRole('button', { name: tr['nav.processes'], exact: true }).click()
  await expect(page.locator('[data-process-pid]').first()).toBeVisible()
  await page.locator('[data-process-pid]').first().click()
  await expect(page.getByRole('complementary')).toBeVisible()
  await application.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.unmaximize(); w.setSize(960, 600) })
  const list = page.getByTestId('process-list')
  await expect(list).toBeVisible()
  await expect.poll(async () => (await list.boundingBox())?.height ?? 0).toBeGreaterThan(200)
  expect(await page.locator('[data-process-pid]').count()).toBeGreaterThan(5)
  await page.screenshot({ path: 'test-results/process-details.png' })
})

test('opens settings as a modal, preserves the page, traps focus, saves settings and closes with Escape', async () => {
  await page.getByRole('navigation').getByRole('button', { name: tr['nav.settings'], exact: true }).click()
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()
  await expect(page.getByTestId('process-list')).toBeVisible()
  await page.keyboard.press('Shift+Tab')
  expect(await modal.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true)
  await modal.getByRole('combobox').selectOption('en')
  await expect(modal.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.localops.getSettings().then((s) => s.locale))).toBe('en')
  await page.screenshot({ path: 'test-results/settings-modal.png' })
  await modal.getByRole('combobox').selectOption('tr')
  await page.keyboard.press('Escape')
  await expect(modal).toHaveCount(0)
  await expect(page.getByTestId('process-list')).toBeVisible()
})

test('renders every navigation page and returns real data from read-only APIs', async () => {
  const keys = ['dashboard', 'performance', 'network', 'health', 'services', 'startup', 'apps', 'drivers', 'tasks', 'sysinfo', 'storage', 'cleanup', 'events', 'automation', 'diag', 'reports', 'processes'] as const
  for (const key of keys) {
    await page.getByRole('navigation').getByRole('button', { name: tr[`nav.${key}`], exact: true }).click()
    await expect(page.locator('main h1')).toBeVisible()
  }
  const result = await page.evaluate(async () => {
    const api = window.localops
    const [processes, connections, services, startup, apps, power, history, diagnostics] = await Promise.all([
      api.getProcesses(), api.getNetworkConnections(), api.getServices(), api.getStartupItems(), api.getInstalledApps(), api.getPowerPlans(), api.getHistoryStatus(), api.runDiagnostics()
    ])
    return { processes: processes.processes.length, connections: Array.isArray(connections.connections), services: Array.isArray(services), startup: Array.isArray(startup), apps: Array.isArray(apps), power: Array.isArray(power), history: history.backend, diagnostics: Array.isArray(diagnostics) }
  })
  expect(result.processes).toBeGreaterThan(0)
  for (const key of ['connections', 'services', 'startup', 'apps', 'power', 'diagnostics'] as const) expect(result[key]).toBe(true)
  expect(['sqlite', 'jsonl']).toContain(result.history)
  expect(errors).toEqual([])
})
