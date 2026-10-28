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
  /** Jours de prise ; absent = tous les jours. */
  rhythm?: Rhythm
  /** Premier jour du traitement (AAAA-MM-JJ). */
  startDate?: string
  /** Dernier jour du traitement, inclus (AAAA-MM-JJ). */
  endDate?: string
  /** À prendre à la demande, sans heure fixe : `times` est alors ignoré. */
  asNeeded?: AsNeeded
  /** Suivi du stock, si l'aidant l'a activé. */
  stock?: Stock
  /** Photo de la boîte, réduite (data URL JPEG). */
  photo?: string
  /** Glycémie à mesurer avant la prise, et dose qui en dépend (insuline). */
  glucose?: GlucoseRule
}

export interface GlucoseRule {
  /**
   * Schéma de dose défini par le médecin, par paliers croissants : la première marche dont `max`
   * (en g/L, exclu) dépasse la glycémie donne le nombre d'unités ; `max` null = au-delà.
   * Vide : la dose de l'ordonnance ne change pas.
   */
  scale: { max: number | null; units: number }[]
}

export interface GlucoseReading {
  id: string
  at: string
  /** En g/L. */
  value: number
  /** La prise avant laquelle la mesure a été faite. */
  doseKey?: string
  by: 'patient' | 'aidant'
}

export interface Stock {
  /** Unités restantes (comprimés, sachets…). */
  units: number
  /** Unités consommées à chaque prise. */
  perDose: number
  /** Unités dans une boîte, ajoutées par « J'ai racheté une boîte ». */
  boxSize: number
}

export interface AsNeeded {
  /** Nombre maximal de prises sur 24 heures glissantes. */
  maxPerDay: number
  /** Écart minimal entre deux prises, en heures. */
  minGapH: number
}

/** Prise d'un médicament « si besoin ». */
export interface AsNeededIntake {
  id: string
  medId: string
  takenAt: string
  by: 'patient' | 'aidant'
  /** Prise faite malgré l'écart minimal ou le maximum. */
  early: boolean
}

export type Rhythm =
  | { kind: 'daily' }
  /** Jours de la semaine, 0 = dimanche … 6 = samedi. */
  | { kind: 'weekdays'; days: number[] }
  /** Un jour sur `every`, à compter du jour `from` (AAAA-MM-JJ). */
  | { kind: 'interval'; every: number; from: string }

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
  /** Prévenir l'aidant quand il reste moins de ce nombre de jours de traitement. */
  refillDays: number
  /** Glycémie basse (hypoglycémie) en dessous de cette valeur, en g/L. */
  hypoBelow: number
  /** Glycémie haute (hyperglycémie) au-dessus de cette valeur, en g/L. */
  hyperAbove: number
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

/** Changement de l'ordonnance, gardé pour les proches, le médecin et le patient. */
export interface TreatmentChange {
  id: string
  at: string
  /** Qui a fait le changement (nom affiché). */
  by: string
  medId: string
  medName: string
  kind: 'ajout' | 'modif' | 'arret' | 'reprise' | 'suppression'
  /** « Dose : 14 unités → 16 unités » */
  details: string[]
  /** Le patient l'a entendu et a confirmé. */
  acknowledged: boolean
}

export interface AppState {
  version: 6
  patient: Patient
  medications: Medication[]
  contacts: Contact[]
  settings: Settings
  /** Prises confirmées, indexées par clé de dose. */
  intakes: Record<string, Intake>
  /** Prises des médicaments « si besoin », les plus récentes d'abord. */
  asNeededIntakes: AsNeededIntake[]
  /** Glycémies mesurées, les plus récentes d'abord. */
  glucose: GlucoseReading[]
  /** Reports en cours, indexés par clé de dose, valeur = ISO de fin. */
  snoozes: Record<string, string>
  alerts: Alert[]
  notes: Note[]
  /** Journal des changements de traitement, les plus récents d'abord. */
  changes: TreatmentChange[]
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
