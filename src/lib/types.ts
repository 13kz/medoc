export type MedForm = 'comprime' | 'gelule' | 'sachet' | 'injection' | 'gouttes' | 'autre'

export interface Medication {
  id: string
  name: string
  form: MedForm
  /** Quantité lisible, ex. « 1 comprimé », « 14 unités ». */
  dose: string
  /** Heures de prise au format HH:MM. */
  times: string[]
  instructions?: string
  /** Couleur de repère, reprise de la boîte ou du comprimé. */
  color: string
  active: boolean
  /** Ajouté à cet instant (ISO) : les prises antérieures ne sont pas dues. */
  since?: string
}

/** Comment le patient perçoit son téléphone. */
export type DisplayMode = 'voix' | 'malvoyant' | 'standard'

export interface Patient {
  /** Nom affiché sur son téléphone et chez l'aidant (« Maman »). */
  name: string
  /** Identité civile, vue par le médecin. */
  fullName: string
  age: number
  conditions: string[]
  displayMode: DisplayMode
  /** Tutoyer le patient dans les messages lus et affichés. */
  tutoiement: boolean
  /** Lire automatiquement à voix haute quand une prise arrive. */
  autoRead: boolean
  voiceRate: number
}

export type ContactRole = 'famille' | 'medecin' | 'tiers'

export interface Contact {
  id: string
  name: string
  role: ContactRole
  /** Reçoit les alertes d'oubli. */
  notify: boolean
}

export interface Intake {
  takenAt: string
  by: 'patient' | 'aidant'
}

/** `rappel` : le téléphone du patient relance. `proches` : les personnes à prévenir sont alertées. */
export type AlertLevel = 'rappel' | 'proches'

export interface Alert {
  id: string
  level: AlertLevel
  /** Création de l'alerte (ISO). */
  at: string
  /** Envoi aux destinataires (ISO) : plus tard que `at` si l'alerte tombe pendant les heures calmes. */
  deliverAt: string
  doseKey: string
  message: string
  recipients: string[]
  read: boolean
  /** La prise a fini par être faite (ISO de la prise). */
  resolvedAt?: string
}

export interface Settings {
  /** Minutes après l'heure prévue avant de considérer la prise en retard et de relancer le patient. */
  lateAfterMin: number
  /** Minutes après la relance avant de prévenir les proches. */
  escalateAfterMin: number
  /** Minutes de report quand le patient répond « plus tard ». */
  snoozeMin: number
  /** Ne pas alerter les proches la nuit : les alertes partent à la fin des heures calmes. */
  quietHours: boolean
  quietFrom: string
  quietTo: string
}

export interface Clock {
  /** Décalage appliqué à l'heure réelle, en millisecondes. */
  offsetMs: number
  /** Facteur d'accélération du temps (1 = temps réel). */
  speed: number
  /** Instant réel où l'accélération a commencé. */
  anchorMs: number
}

/** Message du médecin au patient et à ses proches. */
export interface Note {
  id: string
  at: string
  from: string
  text: string
  /** Le patient a confirmé avoir lu ou entendu le message. */
  acknowledged: boolean
}

export interface AppState {
  version: 3
  patient: Patient
  medications: Medication[]
  contacts: Contact[]
  settings: Settings
  /** Prises confirmées, indexées par clé de dose. */
  intakes: Record<string, Intake>
  /** Reports en cours, indexés par clé de dose, valeur = ISO de fin. */
  snoozes: Record<string, string>
  alerts: Alert[]
  notes: Note[]
  clock: Clock
}

export type DoseStatus = 'pris' | 'a-venir' | 'a-prendre' | 'reporte' | 'en-retard'

export interface Dose {
  key: string
  med: Medication
  time: string
  /** Instant prévu, en ms. */
  at: number
  status: DoseStatus
  intake?: Intake
  snoozedUntil?: number
}
