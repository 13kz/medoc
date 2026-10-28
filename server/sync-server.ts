/**
 * Serveur de synchronisation de Medoc.
 *
 * Il ne comprend pas le contenu du dossier : il garde l'état de départ et la suite des actions,
 * leur donne un numéro d'ordre et les diffuse. Chaque appareil rejoue les actions dans cet
 * ordre avec le même réducteur, donc tous arrivent au même dossier, même après une coupure.
 *
 *   POST /api/dossiers/:id          { base }     crée le dossier s'il n'existe pas
 *   GET  /api/dossiers/:id                       { base, ops, seq }
 *   POST /api/dossiers/:id/ops      { ops }      ajoute des actions (rejouer un envoi ne double rien)
 *   GET  /api/dossiers/:id/events?since=N        flux SSE des actions après N
 *
 * Lancer : node server/sync-server.ts [port] (données dans MEDOC_DATA, par défaut ./data)
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export type Op = { seq: number; opId: string; clientId: string; action: unknown }
type Dossier = { base: unknown; ops: Op[]; opIds: Set<string> }

const ID = /^[A-Za-z0-9_-]{6,64}$/
const MAX_BODY = 4 * 1024 * 1024
const HEARTBEAT_MS = 25_000

export function createSyncServer({ dataDir }: { dataDir?: string } = {}): Server {
  const dossiers = new Map<string, Dossier>()
  const listeners = new Map<string, Set<ServerResponse>>()
  if (dataDir) mkdirSync(dataDir, { recursive: true })

  const fileOf = (id: string) => join(dataDir!, `${id}.json`)

  const get = (id: string): Dossier | undefined => {
    let d = dossiers.get(id)
    if (!d && dataDir) {
      try {
        const raw = JSON.parse(readFileSync(fileOf(id), 'utf8')) as { base: unknown; ops: Op[] }
        d = { base: raw.base, ops: raw.ops, opIds: new Set(raw.ops.map((o) => o.opId)) }
        dossiers.set(id, d)
      } catch {
        // Pas encore de fichier pour ce dossier.
      }
    }
    return d
  }

  const save = (id: string, d: Dossier) => {
    if (!dataDir) return
    // Écriture dans un fichier à côté puis renommage : un arrêt brutal ne laisse pas un dossier à moitié écrit.
    const tmp = `${fileOf(id)}.tmp`
    writeFileSync(tmp, JSON.stringify({ base: d.base, ops: d.ops }))
    renameSync(tmp, fileOf(id))
  }

  const send = (res: ServerResponse, status: number, body?: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(body === undefined ? undefined : JSON.stringify(body))
  }

  const readBody = (req: IncomingMessage) =>
    new Promise<unknown>((resolve, reject) => {
      let size = 0
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => {
        size += c.length
        if (size > MAX_BODY) {
          reject(new Error('trop gros'))
          req.destroy()
        } else chunks.push(c)
      })
      req.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null'))
        } catch (e) {
          reject(e)
        }
      })
      req.on('error', reject)
    })

  const broadcast = (id: string, ops: Op[]) => {
    for (const res of listeners.get(id) ?? []) for (const op of ops) res.write(`id: ${op.seq}\ndata: ${JSON.stringify(op)}\n\n`)
  }

  const server = createServer(async (req, res) => {
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('access-control-allow-headers', 'content-type')
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')
    if (req.method === 'OPTIONS') return send(res, 204)

    const url = new URL(req.url ?? '/', 'http://local')
    const m = url.pathname.match(/^\/api\/dossiers\/([^/]+)(\/ops|\/events)?$/)
    if (!m) return send(res, 404, { error: 'introuvable' })
    const [, id, sub] = m
    if (!ID.test(id)) return send(res, 400, { error: 'identifiant de dossier invalide' })

    try {
      if (!sub && req.method === 'POST') {
        const body = (await readBody(req)) as { base?: unknown } | null
        if (!body || typeof body.base !== 'object' || body.base === null) return send(res, 400, { error: 'état de départ manquant' })
        const existing = get(id)
        if (existing) return send(res, 200, { created: false, seq: existing.ops.length })
        const d: Dossier = { base: body.base, ops: [], opIds: new Set() }
        dossiers.set(id, d)
        save(id, d)
        return send(res, 201, { created: true, seq: 0 })
      }

      const d = get(id)
      if (!d) return send(res, 404, { error: 'dossier inconnu' })

      if (!sub && req.method === 'GET') return send(res, 200, { base: d.base, ops: d.ops, seq: d.ops.length })

      if (sub === '/ops' && req.method === 'POST') {
        const body = (await readBody(req)) as { ops?: { opId?: unknown; clientId?: unknown; action?: unknown }[] } | null
        if (!body || !Array.isArray(body.ops)) return send(res, 400, { error: 'actions manquantes' })
        const added: Op[] = []
        for (const o of body.ops) {
          if (typeof o?.opId !== 'string' || typeof o.clientId !== 'string' || typeof o.action !== 'object' || o.action === null) {
            return send(res, 400, { error: 'action mal formée' })
          }
          // Un envoi rejoué après une coupure ne doit pas compter deux fois la même prise.
          if (d.opIds.has(o.opId)) continue
          const op: Op = { seq: d.ops.length + 1, opId: o.opId, clientId: o.clientId, action: o.action }
          d.ops.push(op)
          d.opIds.add(op.opId)
          added.push(op)
        }
        if (added.length) {
          save(id, d)
          broadcast(id, added)
        }
        return send(res, 200, { seq: d.ops.length })
      }

      if (sub === '/events' && req.method === 'GET') {
        const since = Number(url.searchParams.get('since') ?? req.headers['last-event-id'] ?? 0) || 0
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
        res.write(': medoc\n\n')
        for (const op of d.ops.slice(since)) res.write(`id: ${op.seq}\ndata: ${JSON.stringify(op)}\n\n`)
        let set = listeners.get(id)
        if (!set) listeners.set(id, (set = new Set()))
        set.add(res)
        const beat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS)
        req.on('close', () => {
          clearInterval(beat)
          set!.delete(res)
        })
        return
      }

      send(res, 405, { error: 'méthode non prise en charge' })
    } catch {
      if (!res.headersSent) send(res, 400, { error: 'requête illisible' })
    }
  })

  // Les flux SSE restent ouverts : on les coupe pour que close() se termine.
  const close = server.close.bind(server)
  server.close = (cb) => {
    for (const set of listeners.values()) for (const res of set) res.end()
    server.closeAllConnections()
    return close(cb)
  }
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.argv[2] ?? process.env.PORT ?? 8787)
  createSyncServer({ dataDir: process.env.MEDOC_DATA ?? 'data' }).listen(port, () => {
    console.log(`Medoc, serveur de synchronisation sur http://localhost:${port}`)
  })
}
