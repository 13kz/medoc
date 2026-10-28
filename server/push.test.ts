import { createDecipheriv, createECDH, createHmac, createPublicKey, randomBytes, verify } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { acceptInvitation, createDossier, invite, revokeMember, type Link } from '../src/lib/links'
import { at, makeState, med } from '../src/test/fixtures'
import { createSyncServer, type SyncServer } from './sync-server'
import { generateVapid } from './webpush'

const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest()
const hkdf = (salt: Buffer, ikm: Buffer, info: Buffer, n: number) => hmac(hmac(salt, ikm), Buffer.concat([info, Buffer.from([1])])).subarray(0, n)

/** Un téléphone abonné : sa paire de clés, et ce que le service de push lui a remis. */
function phone(name: string) {
  const ecdh = createECDH('prime256v1')
  const pub = ecdh.generateKeys()
  const auth = randomBytes(16)
  const subscription = { endpoint: `https://push.example/${name}`, keys: { p256dh: pub.toString('base64url'), auth: auth.toString('base64url') } }
  /** Déchiffrement côté navigateur (RFC 8291), pour vérifier ce qui part vraiment. */
  const decrypt = (body: Buffer) => {
    const salt = body.subarray(0, 16)
    const idlen = body.readUInt8(20)
    const asPublic = body.subarray(21, 21 + idlen)
    const data = body.subarray(21 + idlen)
    const ikm = hkdf(auth, ecdh.computeSecret(asPublic), Buffer.concat([Buffer.from('WebPush: info\0'), pub, asPublic]), 32)
    const d = createDecipheriv('aes-128-gcm', hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16), hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12))
    d.setAuthTag(data.subarray(-16))
    const plain = Buffer.concat([d.update(data.subarray(0, -16)), d.final()])
    expect(plain.at(-1)).toBe(2)
    return JSON.parse(plain.subarray(0, -1).toString()) as { title: string; body: string; tag: string; url: string }
  }
  return { subscription, decrypt }
}

const vapid = generateVapid()
let clock = at('2026-03-10 07:00')
let server: SyncServer
let url: string
let sent: { endpoint: string; headers: Record<string, string>; body: Buffer }[]
let gone: Set<string>

const pushFetch: typeof fetch = async (input, init) => {
  const endpoint = String(input)
  sent.push({ endpoint, headers: init!.headers as Record<string, string>, body: Buffer.from(init!.body as Uint8Array) })
  return new Response(null, { status: gone.has(endpoint) ? 410 : 201 })
}

const base = () =>
  makeState({
    patient: { ...makeState().patient, name: 'Maman' },
    medications: [med({ id: 'metformine', name: 'Metformine', times: ['08:00'], since: new Date(at('2026-03-10 00:00')).toISOString() })],
    contacts: [{ id: 'fils', name: 'Naz', role: 'famille', notify: true }],
    settings: { ...makeState().settings, lateAfterMin: 30, escalateAfterMin: 30, quietHours: true, quietFrom: '22:30', quietTo: '07:00' },
  })

const subscribe = (l: Link, sub: ReturnType<typeof phone>['subscription']) =>
  fetch(`${url}/api/dossiers/${l.dossier}/push`, { method: 'POST', headers: { authorization: `Bearer ${l.token}` }, body: JSON.stringify({ subscription: sub }) })

const ops = (l: Link, actions: unknown[]) =>
  fetch(`${url}/api/dossiers/${l.dossier}/ops`, {
    method: 'POST',
    headers: { authorization: `Bearer ${l.token}` },
    body: JSON.stringify({ ops: actions.map((action, i) => ({ opId: `t-${Date.now()}-${i}`, clientId: 'test', action })) }),
  }).then((r) => r.json())

beforeEach(async () => {
  clock = at('2026-03-10 07:00')
  sent = []
  gone = new Set()
  server = createSyncServer({ now: () => clock, vapid, pushFetch, tickMs: 0 })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterEach(() => new Promise((r) => server.close(r)))

describe('alertes push aux proches', () => {
  it('prévient l’aidant abonné, une seule fois, même sans aucune appli ouverte', async () => {
    const aidant = await createDossier(url, base(), 'aidant', 'Naz')
    const naz = phone('naz')
    expect((await subscribe(aidant, naz.subscription)).status).toBe(204)

    clock = at('2026-03-10 08:45')
    await server.tick()
    expect(sent).toHaveLength(0)

    clock = at('2026-03-10 09:01')
    await server.tick()
    expect(sent).toHaveLength(1)
    const msg = naz.decrypt(sent[0].body)
    expect(msg.body).toBe('Maman n’a pas encore pris Metformine (prévu à 8 h).')
    expect(msg.url).toBe('/aidant')
    expect(sent[0].headers['content-encoding']).toBe('aes128gcm')

    clock = at('2026-03-10 09:20')
    await server.tick()
    expect(sent).toHaveLength(1)

    // L'alerte est aussi dans le dossier, pour les appareils qui l'ouvriront.
    const dossier = await fetch(`${url}/api/dossiers/${aidant.dossier}`, { headers: { authorization: `Bearer ${aidant.token}` } }).then((r) => r.json())
    expect(dossier.ops.map((o: { action: { type: string; alert?: { level: string } } }) => o.action.alert?.level)).toEqual(['rappel', 'proches'])
  })

  it('signe l’envoi avec la clé VAPID du serveur', async () => {
    const aidant = await createDossier(url, base(), 'aidant', 'Naz')
    await subscribe(aidant, phone('naz').subscription)
    clock = at('2026-03-10 09:01')
    await server.tick()

    const auth = sent[0].headers.authorization
    const [, jwt, k] = auth.match(/^vapid t=([^,]+), k=(.+)$/)!
    expect(k).toBe((await fetch(`${url}/api/push/key`).then((r) => r.json())).publicKey)
    const [h, c, sig] = jwt.split('.')
    const raw = Buffer.from(k, 'base64url')
    const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33).toString('base64url') }, format: 'jwk' })
    expect(verify('sha256', Buffer.from(`${h}.${c}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'))).toBe(true)
    expect(JSON.parse(Buffer.from(c, 'base64url').toString()).aud).toBe('https://push.example')
  })

  it('annonce la prise faite après l’alerte, à la place de la notification d’oubli', async () => {
    const aidant = await createDossier(url, base(), 'aidant', 'Naz')
    const naz = phone('naz')
    await subscribe(aidant, naz.subscription)
    clock = at('2026-03-10 09:01')
    await server.tick()

    await ops(aidant, [{ type: 'take', doseKey: '2026-03-10|metformine|08:00', by: 'patient', at: at('2026-03-10 09:10') }])
    clock = at('2026-03-10 09:11')
    await server.tick()
    expect(sent).toHaveLength(2)
    const [first, second] = sent.map((s) => naz.decrypt(s.body))
    expect(second.body).toBe('Maman a pris Metformine à 9 h 10.')
    expect(second.tag).toBe(first.tag)
  })

  it('attend la fin des heures calmes', async () => {
    const late = base()
    late.medications = [med({ id: 'metformine', name: 'Metformine', times: ['22:00'], since: new Date(at('2026-03-10 00:00')).toISOString() })]
    const aidant = await createDossier(url, late, 'aidant', 'Naz')
    await subscribe(aidant, phone('naz').subscription)
    clock = at('2026-03-10 23:30')
    await server.tick()
    expect(sent).toHaveLength(0)
    clock = at('2026-03-11 07:00')
    await server.tick()
    expect(sent).toHaveLength(1)
  })

  it('n’envoie qu’aux aidants abonnés et encore autorisés, et oublie un abonnement expiré', async () => {
    const aidant = await createDossier(url, base(), 'aidant', 'Naz')
    const patient = await acceptInvitation(url, (await invite(aidant, 'patient', 'Maman')).code, 'Maman')
    const paul = await acceptInvitation(url, (await invite(aidant, 'aidant', 'Paul')).code, 'Paul')
    const sylvie = await acceptInvitation(url, (await invite(aidant, 'aidant', 'Sylvie')).code, 'Sylvie')
    await subscribe(aidant, phone('naz').subscription)
    await subscribe(patient, phone('maman').subscription)
    await subscribe(paul, phone('paul').subscription)
    await subscribe(sylvie, phone('sylvie').subscription)
    await revokeMember(aidant, paul.memberId)
    gone.add('https://push.example/sylvie')

    clock = at('2026-03-10 09:01')
    await server.tick()
    expect(sent.map((s) => s.endpoint).sort()).toEqual(['https://push.example/naz', 'https://push.example/sylvie'])

    // Deuxième alerte : l'abonnement expiré de Sylvie n'est plus tenté.
    sent = []
    await ops(aidant, [{ type: 'glucose', reading: { id: 'g1', at: new Date(at('2026-03-10 09:30')).toISOString(), value: 0.5 } }])
    clock = at('2026-03-10 09:31')
    await server.tick()
    expect(sent.map((s) => s.endpoint)).toEqual(['https://push.example/naz'])
  })

  it('refuse un abonnement mal formé et un appareil sans accès', async () => {
    const aidant = await createDossier(url, base(), 'aidant', 'Naz')
    const bad = await fetch(`${url}/api/dossiers/${aidant.dossier}/push`, {
      method: 'POST',
      headers: { authorization: `Bearer ${aidant.token}` },
      body: JSON.stringify({ subscription: { endpoint: 'pas une adresse' } }),
    })
    expect(bad.status).toBe(400)
    expect((await subscribe({ ...aidant, token: `${aidant.dossier}.faux` }, phone('x').subscription)).status).toBe(401)
  })
})
