import type { ActionResult, ScheduledTaskInfo, TaskAction } from '@shared/types'
import { extractLastJson, runScriptOnce } from './scriptRunner'
import { TASKS_SCRIPT, taskActionScript } from './scripts'

const VALID_ACTIONS: TaskAction[] = ['run', 'stop', 'enable', 'disable']

export class TaskSchedulerService {
  async list(userOnly: boolean): Promise<ScheduledTaskInfo[]> {
    const out = await runScriptOnce(TASKS_SCRIPT, 90000)
    const parsed = extractLastJson<{
      tasks: Array<{
        path: string
        name: string
        state: string
        author: string
        action: string
        next: number | null
        last: number | null
        lastResult: number | null
      }>
    }>(out)
    if (!parsed?.tasks) return []
    return parsed.tasks
      .filter((t) => typeof t.name === 'string' && t.name.length > 0)
      .filter((t) => (userOnly ? !t.path.toLowerCase().startsWith('\\microsoft') : true))
      .map((t) => ({
        path: t.path,
        name: t.name,
        state: (['Ready', 'Running', 'Disabled', 'Queued'].includes(t.state) ? t.state : 'other') as ScheduledTaskInfo['state'],
        author: t.author || null,
        action: t.action || null,
        nextRun: t.next ?? null,
        lastRun: t.last ?? null,
        lastResult: t.lastResult ?? null
      }))
  }

  async action(taskPath: string, taskName: string, action: TaskAction): Promise<ActionResult> {
    if (!VALID_ACTIONS.includes(action)) return { ok: false, error: 'invalid action' }
    if (!taskPath.startsWith('\\') || taskPath.includes('*') || taskPath.length > 300) {
      return { ok: false, error: 'invalid task path' }
    }
    if (taskName.includes('*') || taskName.length === 0 || taskName.length > 200) {
      return { ok: false, error: 'invalid task name' }
    }
    try {
      const out = await runScriptOnce(taskActionScript(taskPath, taskName, action), 45000)
      const text = out.trim().split('\n').pop()?.trim() ?? ''
      if (text === 'OK') return { ok: true }
      return { ok: false, error: text.startsWith('ERR:') ? text.slice(4) : 'unknown error' }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}
