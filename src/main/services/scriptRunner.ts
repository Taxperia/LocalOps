import { spawn } from 'node:child_process'
import path from 'node:path'

// Never resolve PowerShell from the working directory or PATH.
const POWERSHELL = path.join(process.env['SystemRoot'] || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')

const PS_ARGS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-OutputFormat', 'Text']

function psArgs(script: string): string[] {
  return [...PS_ARGS, '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')]
}

type Child = ReturnType<typeof spawn>
const children = new Set<Child>()
let shuttingDown = false

function spawnPowerShell(script: string): Child {
  const child = spawn(POWERSHELL, psArgs(script), {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  children.add(child)
  child.once('close', () => children.delete(child))
  return child
}

export function stopScriptProcesses(): void {
  shuttingDown = true
  for (const child of children) child.kill()
  children.clear()
}

/**
 * Runs a long-lived PowerShell script and emits every stdout line through onLine.
 * Automatically restarts with backoff if the process dies.
 */
export class ScriptRunner {
  status: 'starting' | 'up' | 'down' = 'starting'
  private child: Child | null = null
  private stopped = false
  private restartTimer: NodeJS.Timeout | null = null
  private failCount = 0
  private stderrTail: string[] = []

  constructor(
    readonly name: string,
    private readonly script: string,
    private readonly onLine: (line: string) => void,
    private readonly onDown?: (lastStderr: string) => void
  ) {}

  start(): void {
    if (this.stopped || shuttingDown) return
    const child = spawnPowerShell(this.script)
    this.child = child
    this.status = 'starting'

    let buf = ''
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      buf += chunk
      let idx = buf.indexOf('\n')
      while (idx >= 0) {
        const line = buf.slice(0, idx).trim()
        buf = buf.slice(idx + 1)
        if (line) {
          if (this.status !== 'up') {
            this.status = 'up'
            this.failCount = 0
          }
          this.onLine(line)
        }
        idx = buf.indexOf('\n')
      }
      if (buf.length > 1_000_000) buf = ''
    })

    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => {
      this.stderrTail.push(chunk)
      if (this.stderrTail.length > 20) this.stderrTail.shift()
    })

    child.on('error', (err) => {
      this.status = 'down'
      console.error(`[sampler:${this.name}] spawn error:`, err.message)
    })

    child.on('close', (code) => {
      this.child = null
      if (this.stopped) return
      this.status = 'down'
      const lastErr = this.stderrTail.join('').slice(-2000)
      console.error(`[sampler:${this.name}] exited with code ${code}. stderr: ${lastErr}`)
      this.onDown?.(lastErr)
      const delay = Math.min(8000, 500 * Math.max(1, ++this.failCount))
      this.restartTimer = setTimeout(() => this.start(), delay)
    })
  }

  stop(): void {
    this.stopped = true
    if (this.restartTimer) clearTimeout(this.restartTimer)
    this.restartTimer = null
    this.child?.kill()
    this.child = null
  }

  get lastStderr(): string {
    return this.stderrTail.join('')
  }
}

/** Runs a one-shot PowerShell script, resolves with full stdout. */
export function runScriptOnce(script: string, timeoutMs = 20000): Promise<string> {
  if (shuttingDown) return Promise.reject(new Error('application is closing'))
  return new Promise((resolve, reject) => {
    const child = spawnPowerShell(script)
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`script timeout (${timeoutMs}ms)`))
    }, timeoutMs)
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (d: string) => (out += d))
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (d: string) => (err += d))
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', () => {
      clearTimeout(timer)
      if (out.trim().length === 0 && err.trim().length > 0) {
        reject(new Error(err.slice(-500)))
      } else {
        resolve(out)
      }
    })
  })
}

/** Extracts the last JSON object line from mixed output. */
export function extractLastJson<T>(text: string): T | null {
  const lines = text.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (line.startsWith('{')) {
      try {
        return JSON.parse(line) as T
      } catch {
        // keep scanning upwards
      }
    }
  }
  return null
}

export interface StreamReaderHandle {
  promise: Promise<void>
  kill: () => void
}

/** Spawns a long-running one-shot script and streams stdout lines (for disk scans). */
export function spawnStreamReader(script: string, onLine: (line: string) => void): StreamReaderHandle {
  if (shuttingDown) return { promise: Promise.resolve(), kill: () => {} }
  const child = spawnPowerShell(script)
  let buf = ''
  child.stdout?.setEncoding('utf8')
  child.stdout?.on('data', (chunk: string) => {
    buf += chunk
    let idx = buf.indexOf('\n')
    while (idx >= 0) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (line) onLine(line)
      idx = buf.indexOf('\n')
    }
  })
  const promise = new Promise<void>((resolve) => {
    child.on('close', () => resolve())
    child.on('error', () => resolve())
  })
  return { promise, kill: () => child.kill() }
}

export function parseJsonLine<T>(line: string): T | null {
  try {
    return JSON.parse(line) as T
  } catch {
    return null
  }
}
