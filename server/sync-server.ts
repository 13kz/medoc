/**
 * Serveur de synchronisation de Medoc.
 *
 * Il ne comprend pas le contenu du dossier : il garde l'état de départ et la suite des actions,
 * leur donne un numéro d'ordre et les diffuse. Chaque appareil rejoue les actions dans cet
 * ordre avec le même réducteur, donc tous arrivent au même dossier, même après une coupure.
 *
 * Chaque appareil a une clé (`Authorization: Bearer …`) liée à un membre du dossier et à son rôle.
 * On entre dans un dossier en le créant, ou avec un code d'invitation donné par le patient ou un aidant.
 *
 *   POST   /api/dossiers                          { base, role, name }  crée un dossier, renvoie la clé
 *   POST   /api/invitations/:code/accept          { name }              rejoint un dossier, renvoie la clé
 *   GET    /api/dossiers/:id                                            { base, ops, seq, me }
 *   POST   /api/dossiers/:id/ops                  { ops }               { seq, rejected }
 *   GET    /api/dossiers/:id/events?since=N                             flux SSE des actions après N
 *   GET    /api/dossiers/:id/members                                    membres et invitations en cours
 *   POST   /api/dossiers/:id/invitations          { role, name? }       { code, expiresAt }
 *   DELETE /api/dossiers/:id/members/:memberId                          retire l'accès
 *   GET    /api/push/key                                                clé publique VAPID
 *   POST   /api/dossiers/:id/push                 { subscription }      alertes push sur cet appareil
 *   DELETE /api/dossiers/:id/push                 { endpoint }
 *
 * Le serveur rejoue aussi le dossier avec le même réducteur que l'appli : il refuse une action qui ne
 * s'applique pas, et fait tourner le moteur d'alertes pour prévenir les aidants par Web Push, même
 * quand aucune appli n'est ouverte.
 *
 * Lancer : npm run server (données dans MEDOC_DATA, par défaut ./data).
 */
import { createHash, randomBytes, randomInt } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { planAlerts, resolvedMessage } from '../src/lib/alerts'
import { reducer, type Action } from '../src/lib/reducer'
import type { AppState } from '../src/lib/types'
import { generateVapid, sendPush, type PushSubscription, type Vapid } from './webpush'

export type Role = 'patient' | 'aidant' | 'medecin'
export type Op = { seq: number; opId: string; clientId: string; by: string; action: { type: string } }
type Member = { id: string; role: Role; name: string; tokenHash: string; createdAt: string; revokedAt?: string; push?: PushSubscription[] }
type Invitation = { code: string; dossier: string; role: Role; name: string; by: string; expiresAt: number }
type Dossier = {
  base: AppState
  ops: Op[]
  members: Member[]
  /** Alertes déjà envoyées par push (et `id:pris` pour le message de fin). */
  pushed: string[]
  opIds: Set<string>
  /** Le dossier rejoué, en mémoire seulement. */
  state: AppState
}

const ROLES: Role[] = ['patient', 'aidant', 'medecin']
const ID = /^[A-Za-z0-9_-]{6,64}$/
const MAX_BODY = 4 * 1024 * 1024
const HEARTBEAT_MS = 25_000
const INVITE_MS = 48 * 3600_000
/** Sans 0/O ni 1/I/L : un code se dicte au téléphone sans erreur. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * Ce que chaque rôle peut faire. Le patient confirme ses prises et règle son affichage ; le médecin
 * modifie l'ordonnance et écrit des conseils ; l'aidant fait tout. Les alertes viennent du moteur
 * d'alertes, qui tourne sur chaque appareil.
 */
const ALERTS = ['addAlert', 'resolveAlert', 'readAlerts', 'ackChange']
const ALLOWED: Record<Role, Set<string> | 'all'> = {
  aidant: 'all',
  patient: new Set(['take', 'untake', 'takeAsNeeded', 'untakeAsNeeded', 'glucose', 'snooze', 'restock', 'ackNote', 'patient', ...ALERTS]),
  medecin: new Set(['upsertMed', 'deleteMed', 'addNote', ...ALERTS]),
}
/** Qui peut inviter et retirer un accès. */
const MANAGERS: Role[] = ['patient', 'aidant']

export const allowed = (role: Role, type: string) => {
  const set = ALLOWED[role]
  return set === 'all' || set.has(type)
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex')
const newId = (bytes = 9) => randomBytes(bytes).toString('base64url')
const newCode = () => Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')
const publicMember = ({ id, role, name, createdAt, revokedAt }: Member) => ({ id, role, name, createdAt, revokedAt })

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export type SyncServerOptions = {
  dataDir?: string
  now?: () => number
  /** Clés VAPID ; par défaut lues dans `MEDOC_DATA/_vapid.json`, créées au premier lancement. */
  vapid?: Vapid
  /** Pour les tests : le `fetch` qui joint les services de push. */
  pushFetch?: typeof fetch
  /** Intervalle du moteur d'alertes ; 0 pour ne le lancer qu'à la main (`tick`). */
  tickMs?: number
}

export type SyncServer = Server & { tick: () => Promise<void> }

export function createSyncServer({ dataDir, now = Date.now, vapid: givenVapid, pushFetch, tickMs = 30_000 }: SyncServerOptions = {}): SyncServer {
  const dossiers = new Map<string, Dossier>()
  /** Flux ouverts, par dossier, avec le membre qui écoute (pour le couper s'il perd l'accès). */
  const listeners = new Map<string, Map<ServerResponse, string>>()
  let invitations = new Map<string, Invitation>()
  if (dataDir) {
    mkdirSync(dataDir, { recursive: true })
    try {
      const list = JSON.parse(readFileSync(join(dataDir, '_invitations.json'), 'utf8')) as Invitation[]
      invitations = new Map(list.map((i) => [i.code, i]))
    } catch {
      // Aucune invitation en cours.
    }
  }

  const fileOf = (id: string) => join(dataDir!, `${id}.json`)

  const vapid: Vapid = givenVapid ?? loadVapid()
  function loadVapid(): Vapid {
    if (!dataDir) return generateVapid()
    const file = join(dataDir, '_vapid.json')
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as Vapid
    } catch {
      const v = generateVapid()
      writeFileSync(file, JSON.stringify(v))
      return v
    }
  }

  const replay = (base: AppState, ops: Op[]) => ops.reduce((s, op) => reducer(s, op.action as Action), base)

  // Écriture dans un fichier à côté puis renommage : un arrêt brutal ne laisse pas un dossier à moitié écrit.
  const writeJson = (file: string, data: unknown) => {
    writeFileSync(`${file}.tmp`, JSON.stringify(data))
    renameSync(`${file}.tmp`, file)
  }

  const get = (id: string): Dossier | undefined => {
    let d = dossiers.get(id)
    if (!d && dataDir && ID.test(id)) {
      try {
        const raw = JSON.parse(readFileSync(fileOf(id), 'utf8')) as Omit<Dossier, 'opIds' | 'state'>
        d = { ...raw, pushed: raw.pushed ?? [], opIds: new Set(raw.ops.map((o) => o.opId)), state: replay(raw.base, raw.ops) }
        dossiers.set(id, d)
      } catch {
        // Pas de fichier pour ce dossier.
      }
    }
    return d
  }

  const save = (id: string, d: Dossier) => {
    if (dataDir) writeJson(fileOf(id), { base: d.base, ops: d.ops, members: d.members, pushed: d.pushed })
  }

  const saveInvitations = () => {
    if (dataDir) writeJson(join(dataDir, '_invitations.json'), [...invitations.values()])
  }

  const dropExpired = () => {
    for (const [code, inv] of invitations) if (inv.expiresAt <= now()) invitations.delete(code)
  }

  /** Clé de la forme `<dossier>.<secret>` : on sait quel dossier charger sans index global. */
  const issueToken = (dossier: string) => `${dossier}.${newId(24)}`

  const authenticate = (req: IncomingMessage, id: string): { d: Dossier; me: Member } => {
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
    const d = token.startsWith(`${id}.`) ? get(id) : undefined
    const me = d?.members.find((m) => m.tokenHash === hash(token))
    if (!d || !me) throw new HttpError(401, 'accès refusé')
    if (me.revokedAt) throw new HttpError(403, 'accès retiré')
    return { d, me }
  }

  const send = (res: ServerResponse, status: number, body?: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(body === undefined ? undefined : JSON.stringify(body))
  }

  const readBody = (req: IncomingMessage) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      let size = 0
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => {
        size += c.length
        if (size > MAX_BODY) {
          reject(new HttpError(413, 'trop gros'))
          req.destroy()
        } else chunks.push(c)
      })
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          resolve(body && typeof body === 'object' ? body : {})
        } catch {
          reject(new HttpError(400, 'requête illisible'))
        }
      })
      req.on('error', reject)
    })

  const cleanName = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : fallback)
  const cleanRole = (v: unknown): Role => {
    if (!ROLES.includes(v as Role)) throw new HttpError(400, 'rôle inconnu')
    return v as Role
  }

  const broadcast = (id: string, ops: Op[]) => {
    for (const res of listeners.get(id)?.keys() ?? []) for (const op of ops) res.write(`id: ${op.seq}\ndata: ${JSON.stringify(op)}\n\n`)
  }

  const append = (d: Dossier, op: Omit<Op, 'seq'>, next: AppState): Op => {
    const full: Op = { seq: d.ops.length + 1, ...op }
    d.ops.push(full)
    d.opIds.add(full.opId)
    d.state = next
    return full
  }

  const addMember = (d: Dossier, id: string, role: Role, name: string) => {
    const token = issueToken(id)
    const member: Member = { id: newId(), role, name, tokenHash: hash(token), createdAt: new Date(now()).toISOString() }
    d.members.push(member)
    save(id, d)
    return { dossier: id, member: publicMember(member), token }
  }

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://local')
    const path = url.pathname

    if (path === '/api/dossiers' && req.method === 'POST') {
      const body = await readBody(req)
      if (typeof body.base !== 'object' || body.base === null) throw new HttpError(400, 'état de départ manquant')
      const role = cleanRole(body.role)
      if (role === 'medecin') throw new HttpError(400, 'un dossier se crée côté patient ou aidant')
      let id = newId()
      while (get(id)) id = newId()
      const base = body.base as AppState
      const d: Dossier = { base, ops: [], members: [], pushed: [], opIds: new Set(), state: base }
      dossiers.set(id, d)
      return send(res, 201, addMember(d, id, role, cleanName(body.name, role)))
    }

    const accept = path.match(/^\/api\/invitations\/([A-Za-z0-9]+)\/accept$/)
    if (accept && req.method === 'POST') {
      const body = await readBody(req)
      dropExpired()
      const inv = invitations.get(accept[1].toUpperCase())
      const d = inv && get(inv.dossier)
      if (!inv || !d) throw new HttpError(404, 'code inconnu ou expiré')
      // Un code ne sert qu'une fois.
      invitations.delete(inv.code)
      saveInvitations()
      return send(res, 201, { ...addMember(d, inv.dossier, inv.role, cleanName(body.name, inv.name)), role: inv.role })
    }

    if (path === '/api/push/key' && req.method === 'GET') return send(res, 200, { publicKey: vapid.publicKey })

    const m = path.match(/^\/api\/dossiers\/([^/]+)(?:\/(ops|events|members|invitations|push)(?:\/([^/]+))?)?$/)
    if (!m) throw new HttpError(404, 'introuvable')
    const [, id, sub, arg] = m
    const { d, me } = authenticate(req, id)

    if (!sub && req.method === 'GET') return send(res, 200, { base: d.base, ops: d.ops, seq: d.ops.length, me: publicMember(me) })

    if (sub === 'ops' && req.method === 'POST') {
      const body = await readBody(req)
      if (!Array.isArray(body.ops)) throw new HttpError(400, 'actions manquantes')
      const added: Op[] = []
      const rejected: string[] = []
      for (const o of body.ops as Record<string, unknown>[]) {
        const action = o?.action as { type?: unknown } | null
        if (typeof o?.opId !== 'string' || typeof o.clientId !== 'string' || typeof action?.type !== 'string') throw new HttpError(400, 'action mal formée')
        // Un envoi rejoué après une coupure ne doit pas compter deux fois la même prise.
        if (d.opIds.has(o.opId)) continue
        if (!allowed(me.role, action.type)) {
          rejected.push(o.opId)
          continue
        }
        // Une action qui ne s'applique pas au dossier (mal formée, autre version) est refusée plutôt que diffusée.
        let next: AppState
        try {
          next = reducer(d.state, action as Action)
        } catch {
          rejected.push(o.opId)
          continue
        }
        added.push(append(d, { opId: o.opId, clientId: o.clientId, by: me.id, action: action as Op['action'] }, next))
      }
      if (added.length) {
        save(id, d)
        broadcast(id, added)
      }
      return send(res, 200, { seq: d.ops.length, rejected })
    }

    if (sub === 'events' && req.method === 'GET') {
      const since = Number(url.searchParams.get('since') ?? req.headers['last-event-id'] ?? 0) || 0
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
      res.write(': medoc\n\n')
      for (const op of d.ops.slice(since)) res.write(`id: ${op.seq}\ndata: ${JSON.stringify(op)}\n\n`)
      let set = listeners.get(id)
      if (!set) listeners.set(id, (set = new Map()))
      set.set(res, me.id)
      const beat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS)
      req.on('close', () => {
        clearInterval(beat)
        set!.delete(res)
      })
      return
    }

    if (sub === 'members' && !arg && req.method === 'GET') {
      dropExpired()
      const pending = [...invitations.values()]
        .filter((i) => i.dossier === id)
        .map(({ code, role, name, expiresAt }) => ({ code: MANAGERS.includes(me.role) ? code : undefined, role, name, expiresAt }))
      return send(res, 200, { members: d.members.map(publicMember), invitations: pending, me: publicMember(me) })
    }

    if (sub === 'invitations' && !arg && req.method === 'POST') {
      if (!MANAGERS.includes(me.role)) throw new HttpError(403, 'seuls le patient et ses aidants invitent')
      const body = await readBody(req)
      const role = cleanRole(body.role)
      dropExpired()
      let code = newCode()
      while (invitations.has(code)) code = newCode()
      const inv: Invitation = { code, dossier: id, role, name: cleanName(body.name, ''), by: me.id, expiresAt: now() + INVITE_MS }
      invitations.set(code, inv)
      saveInvitations()
      return send(res, 201, { code, role, expiresAt: inv.expiresAt })
    }

    if (sub === 'invitations' && arg && req.method === 'DELETE') {
      if (!MANAGERS.includes(me.role)) throw new HttpError(403, 'action réservée au patient et aux aidants')
      const inv = invitations.get(arg)
      if (inv?.dossier === id) {
        invitations.delete(arg)
        saveInvitations()
      }
      return send(res, 204)
    }

    if (sub === 'members' && arg && req.method === 'DELETE') {
      // On peut toujours se retirer soi-même ; retirer quelqu'un d'autre est réservé au patient et aux aidants.
      if (arg !== me.id && !MANAGERS.includes(me.role)) throw new HttpError(403, 'action réservée au patient et aux aidants')
      const target = d.members.find((x) => x.id === arg)
      if (!target) throw new HttpError(404, 'membre inconnu')
      if (!target.revokedAt) {
        target.revokedAt = new Date(now()).toISOString()
        save(id, d)
        for (const [stream, who] of listeners.get(id) ?? []) if (who === target.id) stream.end()
      }
      return send(res, 204)
    }

    if (sub === 'push' && !arg && req.method === 'POST') {
      const body = await readBody(req)
      const subscription = body.subscription as PushSubscription | undefined
      const endpoint = subscription?.endpoint
      if (typeof endpoint !== 'string' || !/^https?:\/\//.test(endpoint) || typeof subscription?.keys?.p256dh !== 'string' || typeof subscription.keys.auth !== 'string') {
        throw new HttpError(400, 'abonnement mal formé')
      }
      const clean: PushSubscription = { endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } }
      me.push = [...(me.push ?? []).filter((p) => p.endpoint !== endpoint), clean]
      save(id, d)
      return send(res, 204)
    }

    if (sub === 'push' && !arg && req.method === 'DELETE') {
      const body = await readBody(req)
      me.push = (me.push ?? []).filter((p) => p.endpoint !== body.endpoint)
      save(id, d)
      return send(res, 204)
    }

    throw new HttpError(405, 'méthode non prise en charge')
  }

  /**
   * Moteur d'alertes côté serveur : crée les alertes comme le ferait un appareil ouvert, puis prévient
   * par push les aidants abonnés quand une alerte aux proches est due, et quand la prise a fini par être faite.
   */
  const tick = async () => {
    if (dataDir) for (const f of readdirSync(dataDir)) if (f.endsWith('.json') && !f.startsWith('_')) get(f.slice(0, -5))
    const t = now()
    for (const [id, d] of dossiers) {
      const plan = planAlerts(d.state, t)
      const added: Op[] = []
      const actions: Action[] = [
        ...plan.create.map((alert): Action => ({ type: 'addAlert', alert })),
        ...plan.resolve.map((r): Action => ({ type: 'resolveAlert', ...r })),
      ]
      for (const action of actions) {
        const next = reducer(d.state, action)
        if (next !== d.state) added.push(append(d, { opId: `serveur-${randomBytes(9).toString('base64url')}`, clientId: 'serveur', by: 'serveur', action }, next))
      }

      const targets = d.members.filter((m) => m.role === 'aidant' && !m.revokedAt && m.push?.length)
      const messages: { key: string; body: string; tag: string }[] = []
      for (const a of d.state.alerts) {
        if (a.level !== 'proches' || Date.parse(a.deliverAt) > t) continue
        const tag = `medoc-${a.doseKey}`
        if (!a.resolvedAt && !d.pushed.includes(a.id)) messages.push({ key: a.id, body: a.message, tag })
        // La prise a été faite après l'alerte : le même emplacement de notification est remplacé.
        if (a.resolvedAt && d.pushed.includes(a.id) && !d.pushed.includes(`${a.id}:pris`)) {
          const done = resolvedMessage(d.state, a)
          if (done) messages.push({ key: `${a.id}:pris`, body: done, tag })
        }
      }

      let changed = added.length > 0
      for (const msg of messages) {
        d.pushed = [...d.pushed, msg.key].slice(-500)
        changed = true
        for (const m of targets) {
          for (const subscription of m.push ?? []) {
            const result = await sendPush(vapid, subscription, { title: 'Medoc', body: msg.body, tag: msg.tag, url: '/aidant' }, pushFetch, t)
            // Abonnement abandonné par le téléphone : on l'oublie.
            if (result === 'expire') m.push = (m.push ?? []).filter((p) => p.endpoint !== subscription.endpoint)
          }
        }
      }
      if (changed) save(id, d)
      if (added.length) broadcast(id, added)
    }
  }

  const server = createServer(async (req, res) => {
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('access-control-allow-headers', 'content-type, authorization')
    res.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS')
    if (req.method === 'OPTIONS') return send(res, 204)
    try {
      await handle(req, res)
    } catch (e) {
      if (res.headersSent) return
      const status = e instanceof HttpError ? e.status : 500
      send(res, status, { error: e instanceof HttpError ? e.message : 'erreur du serveur' })
    }
  })

  let running = false
  const timer = tickMs > 0
    ? setInterval(() => {
        if (running) return
        running = true
        tick().finally(() => (running = false))
      }, tickMs)
    : null
  timer?.unref()

  // Les flux SSE restent ouverts : on les coupe pour que close() se termine.
  const close = server.close.bind(server)
  server.close = (cb) => {
    if (timer) clearInterval(timer)
    for (const set of listeners.values()) for (const res of set.keys()) res.end()
    server.closeAllConnections()
    return close(cb)
  }
  return Object.assign(server, { tick })
}
