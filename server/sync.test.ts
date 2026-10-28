import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { reducer, type Action } from '../src/lib/store'
import { SyncClient } from '../src/lib/sync'
import { at, makeState, med } from '../src/test/fixtures'
import { createSyncServer } from './sync-server'

const memoryStorage = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

async function until(cond: () => boolean, ms = 3000) {
  const end = Date.now() + ms
  while (!cond()) {
    if (Date.now() > end) throw new Error('délai dépassé')
    await new Promise((r) => setTimeout(r, 10))
  }
}

const base = () => makeState({ medications: [med({ id: 'ramipril', times: ['08:00'] })] })
const take: Action = { type: 'take', doseKey: '2026-03-10|ramipril|08:00', by: 'patient', at: at('2026-03-10 08:05') }

let server: ReturnType<typeof createSyncServer>
let url: string
let dataDir: string
const clients: SyncClient<Action>[] = []

function client(opts: { storage?: ReturnType<typeof memoryStorage>; fetch?: typeof fetch } = {}) {
  const c = new SyncClient<Action>({ url, dossier: 'dossier-test', reduce: reducer, initial: base, storage: opts.storage ?? memoryStorage(), fetch: opts.fetch })
  clients.push(c)
  c.start()
  return c
}

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'medoc-'))
  server = createSyncServer({ dataDir })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterEach(async () => {
  for (const c of clients.splice(0)) c.stop()
  await new Promise((r) => server.close(r))
  rmSync(dataDir, { recursive: true, force: true })
})

describe('synchronisation entre appareils', () => {
  it('deux appareils voient la même prise confirmée', async () => {
    const patient = client()
    const aidant = client()
    await until(() => patient.status.online && aidant.status.online)

    patient.dispatch(take)
    await until(() => !!aidant.state?.intakes['2026-03-10|ramipril|08:00'])
    await until(() => patient.status.pending === 0)
    expect(aidant.state!.intakes['2026-03-10|ramipril|08:00'].by).toBe('patient')
    expect(patient.state).toEqual({ ...aidant.state, clock: patient.state!.clock })
  })

  it('un appareil hors ligne garde ses actions et les envoie au retour du réseau', async () => {
    let offline = false
    const flaky: typeof fetch = (input, init) => (offline ? Promise.reject(new TypeError('hors ligne')) : fetch(input, init))
    const patient = client({ fetch: flaky })
    const aidant = client()
    await until(() => patient.status.online && aidant.status.online)

    offline = true
    patient.stop()
    patient.start()
    patient.dispatch(take)
    // La prise s'affiche tout de suite sur le téléphone, même sans réseau.
    expect(patient.state!.intakes['2026-03-10|ramipril|08:00']).toBeDefined()
    expect(patient.status).toEqual({ online: false, pending: 1 })
    await new Promise((r) => setTimeout(r, 50))
    expect(aidant.state!.intakes['2026-03-10|ramipril|08:00']).toBeUndefined()

    offline = false
    patient.retryNow()
    await until(() => !!aidant.state!.intakes['2026-03-10|ramipril|08:00'])
    await until(() => patient.status.pending === 0)
  })

  it('un appareil éteint rattrape son retard au redémarrage', async () => {
    const storage = memoryStorage()
    const aidant = client({ storage })
    const patient = client()
    await until(() => aidant.status.online && patient.status.online)
    aidant.stop()

    patient.dispatch(take)
    patient.dispatch({ type: 'settings', patch: { snoozeMin: 15 } })
    await until(() => patient.status.pending === 0)

    // Nouvelle ouverture de l'application, avec le cache laissé par la précédente.
    const reopened = client({ storage })
    expect(reopened.state!.intakes['2026-03-10|ramipril|08:00']).toBeUndefined()
    await until(() => reopened.state!.settings.snoozeMin === 15)
    expect(reopened.state!.intakes['2026-03-10|ramipril|08:00']).toBeDefined()
  })

  it('les actions de tous sont rejouées dans le même ordre partout', async () => {
    const a = client()
    const b = client()
    await until(() => a.status.online && b.status.online)
    a.dispatch({ type: 'settings', patch: { snoozeMin: 5 } })
    b.dispatch({ type: 'settings', patch: { snoozeMin: 20 } })
    await until(() => a.status.pending === 0 && b.status.pending === 0)
    await until(() => a.state!.settings.snoozeMin === b.state!.settings.snoozeMin)
  })

  it('un renvoi de la même action ne compte pas deux fois', async () => {
    await fetch(`${url}/api/dossiers/dossier-test`, { method: 'POST', body: JSON.stringify({ base: base() }) })
    const op = { opId: 'op-1', clientId: 'c', action: take }
    const send = () => fetch(`${url}/api/dossiers/dossier-test/ops`, { method: 'POST', body: JSON.stringify({ ops: [op] }) }).then((r) => r.json())
    expect(await send()).toEqual({ seq: 1 })
    expect(await send()).toEqual({ seq: 1 })
  })

  it('une action sans effet n’est pas envoyée', async () => {
    const a = client()
    await until(() => a.status.online)
    a.dispatch({ type: 'untake', doseKey: '2026-03-10|ramipril|08:00' })
    expect(a.status.pending).toBe(0)
    a.dispatch(take)
    a.dispatch(take)
    await until(() => a.status.pending === 0)
    const d = await fetch(`${url}/api/dossiers/dossier-test`).then((r) => r.json())
    expect(d.seq).toBe(2)
  })

  it('l’horloge de démo reste propre à chaque appareil', async () => {
    const a = client()
    const b = client()
    await until(() => a.status.online && b.status.online)
    a.dispatch({ type: 'clockJump', deltaMs: 3_600_000, realNow: Date.now() })
    expect(a.state!.clock.offsetMs).toBe(3_600_000)
    expect(a.status.pending).toBe(0)
    expect(b.state!.clock.offsetMs).toBe(0)
  })

  it('le dossier survit à un redémarrage du serveur', async () => {
    const a = client()
    await until(() => a.status.online)
    a.dispatch(take)
    await until(() => a.status.pending === 0)
    a.stop()
    await new Promise((r) => server.close(r))

    server = createSyncServer({ dataDir })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    const fresh = client()
    await until(() => !!fresh.state?.intakes['2026-03-10|ramipril|08:00'])
  })
})
