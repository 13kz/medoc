import { MOMENTS, type Moment, type WeekDay } from '../lib/schedule'

/** Patients d'exemple du cabinet, en plus du dossier relié aux téléphones de la démo. */
export interface SamplePatient {
  id: string
  fullName: string
  age: number
  conditions: string[]
  followers: string[]
  /**
   * Semaine codée par moment (matin, midi, après-midi, soir, coucher), du plus ancien jour à aujourd'hui :
   * x = pris, o = oublié, . = rien de prévu, - = pas encore l'heure.
   */
  week: string[]
  attention: string[]
}

export const SAMPLE_PATIENTS: SamplePatient[] = [
  {
    id: 'lefevre',
    fullName: 'Henri Lefèvre',
    age: 82,
    conditions: ['Diabète de type 2', 'Insuffisance cardiaque'],
    followers: ['Claire (fille)'],
    week: ['xxx..', 'xx.ox', 'x..oo', 'xxxxo', 'x.xxo', 'oxxxx', 'x---'],
    attention: ['Insuline du coucher oubliée 4 fois sur 7', 'Prise du soir souvent décalée de plus d’une heure'],
  },
  {
    id: 'morel',
    fullName: 'Josiane Morel',
    age: 74,
    conditions: ['Diabète de type 1'],
    followers: ['Paul (mari)'],
    week: ['x.x.x', 'x.x.x', 'x.x.x', 'x.x.x', 'x.o.x', 'x.x.x', 'x.---'],
    attention: [],
  },
  {
    id: 'saidi',
    fullName: 'Ahmed Saïdi',
    age: 69,
    conditions: ['Diabète de type 2', 'Hypertension'],
    followers: ['Leïla (fille)', 'Infirmière à domicile'],
    week: ['xx.x.', 'xx.x.', 'ox.x.', 'xx.x.', 'xx.o.', 'xx.x.', 'x-.-.'],
    attention: ['Un oubli le matin, un le soir'],
  },
  {
    id: 'petit',
    fullName: 'Lucienne Petit',
    age: 85,
    conditions: ['Glaucome', 'Arthrose'],
    followers: ['Marc (fils)', 'Voisine'],
    week: ['x..xo', 'x..oo', 'x..xx', 'o..xo', 'x..xx', 'x..xo', 'x..--'],
    attention: ['Collyre du coucher oublié 4 fois sur 7'],
  },
]

const ORDER: Moment[] = ['matin', 'midi', 'apres-midi', 'soir', 'nuit']
const WEEKDAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })

/** Transforme la semaine codée d'un patient d'exemple en semainier. */
export function sampleWeek(p: SamplePatient, now: number): WeekDay[] {
  return p.week.map((code, i) => {
    const ago = p.week.length - 1 - i
    const d = new Date(now)
    d.setDate(d.getDate() - ago)
    return {
      day: d.getTime(),
      label: ago === 0 ? 'Auj.' : WEEKDAY.format(d).replace('.', ''),
      isToday: ago === 0,
      cells: MOMENTS.map((m) => {
        const c = code[ORDER.indexOf(m.id)] ?? '.'
        return { moment: m.id, total: c === '.' ? 0 : 1, taken: c === 'x' ? 1 : 0, missed: c === 'o' ? 1 : 0 }
      }),
    }
  })
}
