import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { acceptInvitation, createDossier, fetchDossier, invite, listMembers, revokeMember, type Link, type Role } from '../src/lib/links'
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

const KEY = '2026-03-10|ramipril|08:00'
const base = () => makeState({ medications: [med({ id: 'ramipril', times: ['08:00'] })] })
const take: Action = { type: 'take', doseKey: KEY, by: 'patient', at: at('2026-03-10 08:05') }

let server: ReturnType<typeof createSyncServer>
let url: string
let dataDir: string
let clock = Date.now()
const clients: SyncClient<Action>[] = []

async function listen() {
  server = createSyncServer({ dataDir, now: () => clock })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

function client(link: Link, opts: { storage?: ReturnType<typeof memoryStorage>; fetch?: typeof fetch } = {}) {
  const c = new SyncClient<Action>({ url, dossier: link.dossier, token: link.token, reduce: reducer, storage: opts.storage ?? memoryStorage(), fetch: opts.fetch })
  clients.push(c)
  c.start()
  return c
}

/** Un dossier créé par l'aidant, et un membre invité avec le rôle demandé. */
async function family(role: Role = 'patient') {
  const aidant = await createDossier(url, base(), 'aidant', 'Claire')
  const { code } = await invite(aidant, role, role === 'patient' ? 'Jeanne' : 'Dr Martin')
  const other = await acceptInvitation(url, code, role === 'patient' ? 'Jeanne' : 'Dr Martin')
  return { aidant, other }
}

const raw = (path: string, token?: string, init: RequestInit = {}) =>
  fetch(`${url}/api${path}`, { ...init, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) } })

beforeEach(async () => {
  clock = Date.now()
  dataDir = mkdtempSync(join(tmpdir(), 'medoc-'))
  await listen()
})

afterEach(async () => {
  for (const c of clients.splice(0)) c.stop()
  await new Promise((r) => server.close(r))
  rmSync(dataDir, { recursive: true, force: true })
})

describe('synchronisation entre appareils', () => {
  it('deux appareils voient la même prise confirmée', async () => {
    const { aidant: a, other: p } = await family()
    const patient = client(p)
    const aidant = client(a)
    await until(() => patient.status.online && aidant.status.online)

    patient.dispatch(take)
    await until(() => !!aidant.state?.intakes[KEY])
    await until(() => patient.status.pending === 0)
    expect(aidant.state!.intakes[KEY].by).toBe('patient')
    expect(patient.state).toEqual({ ...aidant.state, clock: patient.state!.clock })
  })

  it('un appareil hors ligne garde ses actions et les envoie au retour du réseau', async () => {
    const { aidant: a, other: p } = await family()
    let offline = false
    const flaky: typeof fetch = (input, init) => (offline ? Promise.reject(new TypeError('hors ligne')) : fetch(input, init))
    const patient = client(p, { fetch: flaky })
    const aidant = client(a)
    await until(() => patient.status.online && aidant.status.online)

    offline = true
    patient.dropConnection()
    await until(() => !patient.status.online)
    patient.dispatch(take)
    // La prise s'affiche tout de suite sur le téléphone, même sans réseau.
    expect(patient.state!.intakes[KEY]).toBeDefined()
    expect(patient.status).toMatchObject({ online: false, pending: 1 })
    await new Promise((r) => setTimeout(r, 50))
    expect(aidant.state!.intakes[KEY]).toBeUndefined()

    offline = false
    patient.retryNow()
    await until(() => !!aidant.state!.intakes[KEY])
    await until(() => patient.status.pending === 0)
  })

  it('un appareil éteint rattrape son retard au redémarrage', async () => {
    const { aidant: a, other: p } = await family()
    const storage = memoryStorage()
    const aidant = client(a, { storage })
    const patient = client(p)
    await until(() => aidant.status.online && patient.status.online)
    aidant.stop()

    patient.dispatch(take)
    patient.dispatch({ type: 'patient', patch: { name: 'Mamie' } })
    await until(() => patient.status.pending === 0)

    // Nouvelle ouverture de l'application, avec le cache laissé par la précédente.
    const reopened = client(a, { storage })
    expect(reopened.state!.intakes[KEY]).toBeUndefined()
    await until(() => reopened.state!.patient.name === 'Mamie')
    expect(reopened.state!.intakes[KEY]).toBeDefined()
  })

  it('les actions de tous sont rejouées dans le même ordre partout', async () => {
    const { aidant: a } = await family()
    const second = await acceptInvitation(url, (await invite(a, 'aidant', 'Paul')).code, 'Paul')
    const x = client(a)
    const y = client(second)
    await until(() => x.status.online && y.status.online)
    x.dispatch({ type: 'settings', patch: { snoozeMin: 5 } })
    y.dispatch({ type: 'settings', patch: { snoozeMin: 20 } })
    await until(() => x.status.pending === 0 && y.status.pending === 0)
    await until(() => x.state!.settings.snoozeMin === y.state!.settings.snoozeMin)
  })

  it('un renvoi de la même action ne compte pas deux fois', async () => {
    const { aidant } = await family()
    const op = { opId: 'op-1', clientId: 'c', action: take }
    const send = () => raw(`/dossiers/${aidant.dossier}/ops`, aidant.token, { method: 'POST', body: JSON.stringify({ ops: [op] }) }).then((r) => r.json())
    expect(await send()).toEqual({ seq: 1, rejected: [] })
    expect(await send()).toEqual({ seq: 1, rejected: [] })
  })

  it('une action sans effet n’est pas envoyée', async () => {
    const { aidant } = await family()
    const a = client(aidant)
    await until(() => a.status.online)
    a.dispatch({ type: 'untake', doseKey: KEY })
    expect(a.status.pending).toBe(0)
  })

  it('l’horloge de démo reste propre à chaque appareil', async () => {
    const { aidant: x, other: y } = await family()
    const a = client(x)
    const b = client(y)
    await until(() => a.status.online && b.status.online)
    a.dispatch({ type: 'clockJump', deltaMs: 3_600_000, realNow: Date.now() })
    expect(a.state!.clock.offsetMs).toBe(3_600_000)
    expect(a.status.pending).toBe(0)
    expect(b.state!.clock.offsetMs).toBe(0)
  })

  it('le dossier et les accès survivent à un redémarrage du serveur', async () => {
    const { aidant: x, other: p } = await family()
    const a = client(x)
    await until(() => a.status.online)
    a.dispatch(take)
    await until(() => a.status.pending === 0)
    a.stop()
    await new Promise((r) => server.close(r))

    await listen()
    const fresh = client({ ...p, url })
    await until(() => !!fresh.state?.intakes[KEY])
  })
})

describe('accès au dossier', () => {
  it('un proche non invité n’accède à rien', async () => {
    const { aidant } = await family()
    const other = await createDossier(url, base(), 'aidant', 'Inconnu')
    const id = aidant.dossier
    for (const token of [undefined, 'n-importe-quoi', `${id}.faux`, other.token]) {
      expect((await raw(`/dossiers/${id}`, token)).status).toBe(401)
      expect((await raw(`/dossiers/${id}/events`, token)).status).toBe(401)
      expect((await raw(`/dossiers/${id}/members`, token)).status).toBe(401)
      expect((await raw(`/dossiers/${id}/ops`, token, { method: 'POST', body: JSON.stringify({ ops: [{ opId: 'x', clientId: 'x', action: take }] }) })).status).toBe(401)
      expect((await raw(`/dossiers/${id}/invitations`, token, { method: 'POST', body: JSON.stringify({ role: 'aidant' }) })).status).toBe(401)
    }
    // Rien n'a été écrit dans le dossier.
    expect((await fetchDossier(aidant, reducer)).intakes[KEY]).toBeUndefined()
    // Avec un client : accès refusé, et aucune donnée affichée.
    const intrus = client({ ...aidant, token: `${id}.faux` })
    await until(() => intrus.status.access === 'refuse')
    expect(intrus.state).toBeNull()
  })

  it('un proche révoqué perd l’accès, y compris son flux en direct', async () => {
    const { aidant, other: proche } = await family('aidant')
    const watcher = client(proche)
    await until(() => watcher.status.online)

    await revokeMember(aidant, proche.memberId)
    await until(() => watcher.status.access === 'retire')
    expect(watcher.status.online).toBe(false)
    expect((await raw(`/dossiers/${aidant.dossier}`, proche.token)).status).toBe(403)
    expect((await raw(`/dossiers/${aidant.dossier}/events`, proche.token)).status).toBe(403)

    // Les autres continuent normalement.
    const a = client(aidant)
    a.dispatch(take)
    await until(() => a.status.online && a.status.pending === 0)
    const { members } = await listMembers(aidant)
    expect(members.find((m) => m.id === proche.memberId)?.revokedAt).toBeDefined()
  })

  it('un code d’invitation ne sert qu’une fois et expire au bout de 48 h', async () => {
    const aidant = await createDossier(url, base(), 'aidant', 'Claire')
    const { code } = await invite(aidant, 'aidant', 'Paul')
    await acceptInvitation(url, code, 'Paul')
    await expect(acceptInvitation(url, code, 'Pierre')).rejects.toMatchObject({ status: 404 })

    const late = await invite(aidant, 'aidant', 'Luc')
    clock += 49 * 3600_000
    await expect(acceptInvitation(url, late.code, 'Luc')).rejects.toMatchObject({ status: 404 })
  })

  it('chaque rôle n’envoie que ce qu’il a le droit de faire', async () => {
    const { aidant, other: p } = await family('patient')
    const doc = await acceptInvitation(url, (await invite(aidant, 'medecin', 'Dr Martin')).code, 'Dr Martin')
    const patient = client(p)
    const medecin = client(doc)
    await until(() => patient.status.online && medecin.status.online)

    // Le patient confirme sa prise mais ne touche pas à l'ordonnance.
    patient.dispatch(take)
    patient.dispatch({ type: 'deleteMed', id: 'ramipril' })
    await until(() => patient.status.pending === 0)
    expect(patient.status.rejected).toBe(1)
    expect(patient.state!.medications).toHaveLength(1)
    expect(patient.state!.intakes[KEY]).toBeDefined()

    // Le médecin modifie l'ordonnance, mais ne valide pas une prise à la place du patient.
    medecin.dispatch({ type: 'upsertMed', med: med({ id: 'ramipril', dose: '2 comprimés' }), by: 'Dr Martin', at: Date.now() })
    await until(() => !!medecin.state!.intakes[KEY])
    medecin.dispatch({ type: 'untake', doseKey: KEY })
    await until(() => medecin.status.pending === 0)
    expect(medecin.status.rejected).toBe(1)
    await until(() => patient.state!.medications[0].dose === '2 comprimés')
    expect(patient.state!.intakes[KEY]).toBeDefined()

    // Seuls le patient et les aidants invitent ou retirent un accès.
    await expect(invite(doc, 'aidant', 'Quelqu’un')).rejects.toMatchObject({ status: 403 })
    await expect(revokeMember(doc, p.memberId)).rejects.toMatchObject({ status: 403 })
    expect((await invite(p, 'aidant', 'Paul')).code).toMatch(/^[A-Z2-9]{8}$/)
  })

  it('le médecin retrouve chacun des dossiers auxquels il est invité', async () => {
    const a = await createDossier(url, makeState({ patient: { ...base().patient, fullName: 'Jeanne Dupont' } }), 'aidant', 'Claire')
    const b = await createDossier(url, makeState({ patient: { ...base().patient, fullName: 'Henri Leroy' } }), 'patient', 'Henri')
    const links = [
      await acceptInvitation(url, (await invite(a, 'medecin', '')).code, 'Dr Martin'),
      await acceptInvitation(url, (await invite(b, 'medecin', '')).code, 'Dr Martin'),
    ]
    expect(links.map((l) => l.role)).toEqual(['medecin', 'medecin'])
    const names = await Promise.all(links.map((l) => fetchDossier(l, reducer).then((s) => s.patient.fullName)))
    expect(names).toEqual(['Jeanne Dupont', 'Henri Leroy'])
  })
})
