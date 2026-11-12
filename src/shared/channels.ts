export const IPC = {
  updateStatus: 'updates:status',
  updateCheck: 'updates:check',
  updateInstall: 'updates:install',
  updateEvent: 'updates:changed',
  // invoke (renderer -> main)
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  staticInfo: 'static:info',
  metricsHistory: 'metrics:history',
  processesList: 'processes:list',
  processDetails: 'processes:details',
  processKill: 'processes:kill',
  processPriority: 'processes:priority',
  appInfo: 'app:info',
  windowControl: 'window:control',
  windowIsMaximized: 'window:is-maximized',
  openDataFolder: 'app:open-data-folder',
  clipboardWrite: 'clipboard:write',
  // network monitor
  networkConnections: 'network:connections',
  // services
  servicesList: 'services:list',
  serviceAction: 'services:action',
  serviceSetStartup: 'services:set-startup',
  // startup
  startupList: 'startup:list',
  startupToggle: 'startup:toggle',
  // apps
  appsList: 'apps:list',
  appUninstall: 'apps:uninstall',
  // events
  eventsQuery: 'events:query',
  // disk scan
  diskScanStart: 'diskscan:start',
  diskScanCancel: 'diskscan:cancel',
  diskScanGet: 'diskscan:get',
  diskScanEvent: 'diskscan:event',
  // task scheduler
  tasksList: 'tasks:list',
  taskAction: 'tasks:action',
  // drivers
  driversList: 'drivers:list',
  // power
  powerPlans: 'power:plans',
  powerSetActive: 'power:set-active',
  // cleanup
  cleanupScan: 'cleanup:scan',
  cleanupClean: 'cleanup:clean',
  // health
  healthInfo: 'health:info',
  // diagnostics
  diagRun: 'diag:run',
  // automation
  automationTest: 'automation:test',
  automationFiredEvent: 'automation:fired',
  // history
  historyStatus: 'history:status',
  historyQuery: 'history:query',
  historyStats: 'history:stats',
  historyExport: 'history:export',
  // elevation
  appRestartElevated: 'app:restart-elevated',
  // events (main -> renderer)
  metricsEvent: 'metrics:snapshot',
  processesEvent: 'processes:update',
  alertsEvent: 'alerts:triggered',
  settingsEvent: 'settings:changed'
} as const
