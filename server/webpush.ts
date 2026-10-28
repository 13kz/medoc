/**
 * Envoi Web Push sans dépendance : chiffrement du message (RFC 8291, aes128gcm) et
 * identification du serveur auprès du service de push (VAPID, RFC 8292).
 */
import { createCipheriv, createECDH, createHmac, createPrivateKey, generateKeyPairSync, randomBytes, sign } from 'node:crypto'

export type PushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } }
/** Clés VAPID : publique brute (65 octets) en base64url, privée en JWK. */
export type Vapid = { publicKey: string; privateJwk: { kty: string; crv: string; x: string; y: string; d: string }; subject: string }

const b64 = (b: Buffer) => b.toString('base64url')
const unb64 = (s: string) => Buffer.from(s, 'base64url')

const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest()
/** HKDF en une passe : extraction puis un seul bloc d'expansion, suffisant pour des clés de 32 octets au plus. */
const hkdf = (salt: Buffer, ikm: Buffer, info: Buffer, length: number) => hmac(hmac(salt, ikm), Buffer.concat([info, Buffer.from([1])])).subarray(0, length)

export function generateVapid(subject = 'mailto:contact@medoc.app'): Vapid {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const jwk = privateKey.export({ format: 'jwk' }) as Vapid['privateJwk']
  const publicKey = b64(Buffer.concat([Buffer.from([4]), unb64(jwk.x), unb64(jwk.y)]))
  return { publicKey, privateJwk: jwk, subject }
}

/** Corps chiffré pour un abonnement : en-tête (sel, taille de bloc, clé éphémère) puis un seul bloc. */
export function encrypt(sub: PushSubscription, payload: string): Buffer {
  const uaPublic = unb64(sub.keys.p256dh)
  const authSecret = unb64(sub.keys.auth)
  const ecdh = createECDH('prime256v1')
  const asPublic = ecdh.generateKeys()
  const shared = ecdh.computeSecret(uaPublic)
  const salt = randomBytes(16)

  const ikm = hkdf(authSecret, shared, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32)
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16)
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12)

  const cipher = createCipheriv('aes-128-gcm', cek, nonce)
  // 0x02 : dernier (et seul) bloc.
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()])
  const header = Buffer.alloc(21)
  salt.copy(header, 0)
  header.writeUInt32BE(4096, 16)
  header.writeUInt8(asPublic.length, 20)
  return Buffer.concat([header, asPublic, body])
}

/** En-tête `Authorization` VAPID pour le service de push de `endpoint`. */
export function vapidAuthorization(vapid: Vapid, endpoint: string, now = Date.now()): string {
  const aud = new URL(endpoint).origin
  const head = b64(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64(Buffer.from(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: vapid.subject })))
  const key = createPrivateKey({ key: vapid.privateJwk, format: 'jwk' })
  const signature = sign('sha256', Buffer.from(`${head}.${claims}`), { key, dsaEncoding: 'ieee-p1363' })
  return `vapid t=${head}.${claims}.${b64(signature)}, k=${vapid.publicKey}`
}

export type PushResult = 'envoye' | 'expire' | 'echec'

/** Envoie un message ; `expire` signifie que l'abonnement n'existe plus et doit être oublié. */
export async function sendPush(vapid: Vapid, sub: PushSubscription, payload: unknown, f: typeof fetch = fetch, now = Date.now()): Promise<PushResult> {
  try {
    const res = await f(sub.endpoint, {
      method: 'POST',
      headers: {
        authorization: vapidAuthorization(vapid, sub.endpoint, now),
        'content-encoding': 'aes128gcm',
        'content-type': 'application/octet-stream',
        ttl: String(12 * 3600),
        urgency: 'high',
      },
      body: new Uint8Array(encrypt(sub, JSON.stringify(payload))),
    })
    if (res.status === 404 || res.status === 410) return 'expire'
    return res.ok ? 'envoye' : 'echec'
  } catch {
    return 'echec'
  }
}
