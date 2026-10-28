import type { AppState } from './types'

/**
 * Synchronisation d'un dossier avec le serveur (`server/sync-server.ts`).
 *
 * Le dossier affiché = état confirmé par le serveur + actions locales pas encore confirmées.
 * Chaque action part avec un identifiant unique : la file d'attente est rejouée au retour du réseau
 * sans risque de doublon, et les actions de tous les appareils sont rejouées dans l'ordre du serveur.
 * L'horloge reste propre à chaque appareil.
 */

type AnyAction = { type: string }
type Reduce<A> = (state: AppState, action: A) => AppState
type PendingOp<A> = { opId: string; clientId: string; action: A }
type ServerOp<A> = PendingOp<A> & { seq: number }

export type SyncStatus = { online: boolean; pending: number }

type Cache<A> = { clientId: string; seq: number; confirmed: AppState; pending: PendingOp<A>[] }

export type SyncOptions<A> = {
  /** Adresse du serveur, sans `/api`. Vide : même origine. */
  url: string
  dossier: string
  reduce: Reduce<A>
  /** État de départ si le dossier n'existe pas encore sur le serveur. */
  initial: () => AppState
  onChange?: (state: AppState, status: SyncStatus) => void
  fetch?: typeof fetch
  storage?: Pick<Storage, 'getItem' | 'setItem'>
}

/** Actions qui ne concernent que cet appareil. */
const LOCAL_ONLY = new Set(['clockJump', 'clockSpeed', 'clockReset'])

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`)

export class SyncClient<A extends AnyAction> {
  private o: SyncOptions<A>
  private fetch: typeof fetch
  private key: string
  private clientId: string
  private seq = 0
  private confirmed: AppState | null = null
  private pending: PendingOp<A>[] = []
  private clock: AppState['clock'] | null = null
  private online = false
  private abort: AbortController | null = null
  private flushing = false
  private flushAgain = false
  private retry: ReturnType<typeof setTimeout> | null = null
  private delay = 1000
  private stopped = true

  constructor(o: SyncOptions<A>) {
    this.o = o
    this.fetch = o.fetch ?? globalThis.fetch.bind(globalThis)
    this.key = `medoc:sync:${o.dossier}`
    const cache = this.read()
    this.clientId = cache?.clientId ?? newId()
    if (cache) {
      this.seq = cache.seq
      this.confirmed = cache.confirmed
      this.pending = cache.pending
      this.clock = cache.confirmed.clock
    }
  }

  /** Le dossier tel qu'il doit s'afficher, ou null tant qu'il n'a jamais été chargé. */
  get state(): AppState | null {
    if (!this.confirmed) return null
    const s = this.pending.reduce((acc, op) => this.o.reduce(acc, op.action), this.confirmed)
    return this.clock ? { ...s, clock: this.clock } : s
  }

  get status(): SyncStatus {
    return { online: this.online, pending: this.pending.length }
  }

  dispatch(action: A) {
    if (LOCAL_ONLY.has(action.type)) {
      const view = this.state
      if (view) this.clock = this.o.reduce(view, action).clock
    } else {
      // Action sans effet ici (alerte déjà créée par un autre appareil…) : inutile de l'envoyer.
      const view = this.state
      if (view && this.o.reduce(view, action) === view) return
      this.pending.push({ opId: newId(), clientId: this.clientId, action })
      this.flush()
    }
    this.changed()
  }

  start() {
    if (!this.stopped) return
    this.stopped = false
    void this.connect()
  }

  stop() {
    this.stopped = true
    this.abort?.abort()
    this.abort = null
    if (this.retry) clearTimeout(this.retry)
    this.retry = null
    this.setOnline(false)
  }

  /** À appeler quand le système annonce la perte du réseau : un flux ouvert peut rester muet longtemps. */
  dropConnection() {
    this.abort?.abort()
  }

  /** À appeler quand le réseau revient : on n'attend pas la prochaine tentative. */
  retryNow() {
    if (this.stopped || this.online) return
    if (this.retry) clearTimeout(this.retry)
    this.retry = null
    this.delay = 1000
    void this.connect()
  }

  private api(path = '') {
    return `${this.o.url.replace(/\/$/, '')}/api/dossiers/${encodeURIComponent(this.o.dossier)}${path}`
  }

  private async connect() {
    this.abort?.abort()
    const abort = (this.abort = new AbortController())
    try {
      if (!this.confirmed) await this.load()
      const res = await this.fetch(this.api(`/events?since=${this.seq}`), { signal: abort.signal, headers: { accept: 'text/event-stream' } })
      if (res.status === 404) {
        // Dossier effacé côté serveur : on le recrée à partir de ce qu'on a.
        await this.create(this.confirmed!)
        throw new Error('recréé')
      }
      if (!res.ok || !res.body) throw new Error(`flux ${res.status}`)
      this.delay = 1000
      this.setOnline(true)
      this.flush()
      await this.readStream(res.body, abort.signal)
      throw new Error('flux fermé')
    } catch {
      if (abort !== this.abort) return
      this.abort = null
      this.setOnline(false)
      if (!this.stopped) {
        this.retry = setTimeout(() => void this.connect(), this.delay)
        this.delay = Math.min(this.delay * 2, 30_000)
      }
    }
  }

  private async load(): Promise<void> {
    const res = await this.fetch(this.api())
    if (res.status === 404) {
      const base = { ...this.o.initial() }
      await this.create(base)
      return this.load()
    }
    if (!res.ok) throw new Error(`dossier ${res.status}`)
    const { base, ops } = (await res.json()) as { base: AppState; ops: ServerOp<A>[] }
    this.confirmed = base
    this.seq = 0
    if (!this.clock) this.clock = base.clock
    for (const op of ops) this.apply(op)
    this.save()
    this.changed()
  }

  private async create(base: AppState) {
    const res = await this.fetch(this.api(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ base }) })
    if (!res.ok) throw new Error(`création ${res.status}`)
  }

  private async readStream(body: ReadableStream<Uint8Array>, signal: AbortSignal) {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    signal.addEventListener('abort', () => void reader.cancel().catch(() => {}))
    for (;;) {
      const { value, done } = await reader.read()
      if (done) return
      buf += decoder.decode(value, { stream: true })
      let end
      while ((end = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, end)
        buf = buf.slice(end + 2)
        const data = chunk
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trimStart())
          .join('\n')
        if (!data) continue
        const op = JSON.parse(data) as ServerOp<A>
        if (op.seq > this.seq + 1) {
          // Trou dans la suite : on recharge tout plutôt que de deviner.
          this.confirmed = null
          await this.load()
          continue
        }
        if (this.apply(op)) {
          this.save()
          this.changed()
        }
      }
    }
  }

  private apply(op: ServerOp<A>): boolean {
    if (op.seq <= this.seq || !this.confirmed) return false
    this.confirmed = this.o.reduce(this.confirmed, op.action)
    this.seq = op.seq
    this.pending = this.pending.filter((p) => p.opId !== op.opId)
    return true
  }

  private async flush() {
    if (this.flushing) {
      this.flushAgain = true
      return
    }
    if (!this.online || this.pending.length === 0) return this.save()
    this.dropNoops()
    if (this.pending.length === 0) {
      this.save()
      return this.changed()
    }
    this.flushing = true
    this.save()
    try {
      const res = await this.fetch(this.api('/ops'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ops: this.pending }),
      })
      if (!res.ok) throw new Error(`envoi ${res.status}`)
    } catch {
      // Les actions restent dans la file ; elles repartiront à la reconnexion.
    } finally {
      this.flushing = false
      if (this.flushAgain) {
        this.flushAgain = false
        void this.flush()
      }
    }
  }

  /** Retire de la file ce qui n'a plus d'effet sur le dossier confirmé, par exemple une alerte déjà créée ailleurs. */
  private dropNoops() {
    let s = this.confirmed
    if (!s) return
    this.pending = this.pending.filter((op) => {
      const next = this.o.reduce(s!, op.action)
      if (next === s) return false
      s = next
      return true
    })
  }

  private setOnline(online: boolean) {
    if (this.online === online) return
    this.online = online
    this.changed()
  }

  private changed() {
    const s = this.state
    if (s) this.o.onChange?.(s, this.status)
  }

  private read(): Cache<A> | null {
    try {
      const raw = this.o.storage?.getItem(this.key)
      return raw ? (JSON.parse(raw) as Cache<A>) : null
    } catch {
      return null
    }
  }

  private save() {
    if (!this.confirmed) return
    try {
      const cache: Cache<A> = { clientId: this.clientId, seq: this.seq, confirmed: { ...this.confirmed, clock: this.clock ?? this.confirmed.clock }, pending: this.pending }
      this.o.storage?.setItem(this.key, JSON.stringify(cache))
    } catch {
      // Stockage plein ou indisponible : la synchronisation continue en mémoire.
    }
  }
}

const CONFIG_KEY = 'medoc:sync'

export type SyncConfig = { url: string; dossier: string }

/**
 * Dossier partagé de cet appareil. On le rejoint une fois avec `?dossier=…` (et `&serveur=…` si le
 * serveur n'est pas à la même adresse), puis il est retenu ; `?dossier=aucun` revient au mode local.
 */
export function syncConfig(search = location.search, storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage): SyncConfig | null {
  try {
    const params = new URLSearchParams(search)
    const dossier = params.get('dossier')
    if (dossier === 'aucun') {
      storage.removeItem(CONFIG_KEY)
      return null
    }
    if (dossier && /^[A-Za-z0-9_-]{6,64}$/.test(dossier)) {
      const cfg = { dossier, url: params.get('serveur') ?? (import.meta.env.VITE_SYNC_URL as string | undefined) ?? '' }
      storage.setItem(CONFIG_KEY, JSON.stringify(cfg))
      return cfg
    }
    const raw = storage.getItem(CONFIG_KEY)
    return raw ? (JSON.parse(raw) as SyncConfig) : null
  } catch {
    return null
  }
}
