/**
 * Tout ce que l'appli native reprend du code partagé (`src/lib` à la racine du dépôt).
 * Rien ici ne dépend du navigateur.
 */
export * from '../../src/lib/types'
export * from '../../src/lib/schedule'
export * from '../../src/lib/phrases'
export * from '../../src/lib/stock'
export * from '../../src/lib/asNeeded'
export * from '../../src/lib/changes'
export { reducer, simulatedNow, type Action } from '../../src/lib/reducer'
export { seedState } from '../../src/lib/seed'
export { parseStored } from '../../src/lib/migrate'
export { planAlerts, deliveredAlerts, resolvedMessage } from '../../src/lib/alerts'
export { upcomingReminders, remindersSignature, type Reminder } from '../../src/lib/reminders'
export { SyncClient, type SyncStatus } from '../../src/lib/sync'
export * from '../../src/lib/dossierApi'
export { ICON_PATHS, type IconName } from '../../src/lib/icons'
export { SAMPLE_PATIENTS, sampleWeek, type SamplePatient } from '../../src/doctor/roster'
