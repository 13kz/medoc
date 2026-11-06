import { LiveBox } from '@/components/LiveBox'
import { InView, LockScreen, Voice } from '@/components/day/Moments'
import { PatientStage } from '@/components/day/PatientStage'
import { Rail } from '@/components/day/Rail'
import { Prototype } from '@/components/proto/Prototype'
import { StoreProvider } from '@/lib/store'

/*
 * Le site raconte une journée de Mireille, de 7 h 55 à 22 h.
 * Chaque moment emprunte la forme de l'écran ou du papier de celui qui le vit :
 * le téléphone de la patiente, l'écran verrouillé du fils, le compte rendu du médecin,
 * la notice du médicament. Le menu est une réglette horaire en bas de l'écran.
 */

const WEEK = ['ven', 'sam', 'dim', 'lun', 'mar', 'mer', 'jeu']
// x pris, o oublié, - pas encore l'heure
const SHEET: { label: string; tone: string; cells: string; note?: boolean }[] = [
  { label: 'Matin', tone: '#ffd43b', cells: 'xxxxxxx' },
  { label: 'Midi', tone: '#ff9f43', cells: 'xxxxoxx' },
  { label: 'Soir', tone: '#6cb4ff', cells: 'xoxxxxx' },
  { label: 'Coucher', tone: '#b69cff', cells: 'xooxoxx', note: true },
]

const MATRIX: { what: string; p: string; f: string; d: string }[] = [
  { what: 'La prise du moment, lue à voix haute', p: '●', f: '○', d: '–' },
  { what: '« Tout va bien », en une phrase', p: '–', f: '●', d: '–' },
  { what: 'Alerte quand la relance n’a pas suffi', p: '–', f: '●', d: '–' },
  { what: 'Stock et renouvellement', p: '–', f: '●', d: '–' },
  { what: 'Réglage du téléphone de la patiente', p: '–', f: '●', d: '–' },
  { what: 'Observance sur 7 jours, oublis répétés', p: '–', f: '○', d: '●' },
  { what: 'Glycémie', p: '–', f: '○', d: '●' },
  { what: 'Modifier l’ordonnance', p: '–', f: '○', d: '●' },
  { what: 'Conseil du médecin', p: '●', f: '○', d: '●' },
]

export default function Home() {
  return (
    <StoreProvider>
      <Rail />
      <main>
        {/* 7 h 55 · Le téléphone parle */}
        <section id="reveil" className="s-reveil">
          <p className="s-reveil-brand">
            medoc<sup>®</sup>
            <span>pilulier partagé · prototype</span>
          </p>
          <Voice />
          <p className="s-reveil-aside">
            Un pilulier qui parle à Mireille, rassure son fils et informe son médecin. Chacun reçoit ce qu’il doit savoir, et rien d’autre.
            <br />
            <b>Faites défiler : la journée commence.</b>
          </p>
          <div className="s-reveil-table" aria-hidden="true">
            <LiveBox className="s-reveil-box" interactive={false} camera={[0, 9.4, 4.4]} />
          </div>
        </section>

        {/* 8 h 00 · La section devient le téléphone de Mireille */}
        <section id="matin" className="s-matin">
          <InView className="s-matin-intro">
            <p className="s-stamp">8 h 00 · Mireille, 78 ans · glaucome, diabète</p>
            <h2>
              UNE CHOSE
              <br />À LA FOIS.
            </h2>
          </InView>
          <PatientStage />
          <aside className="s-matin-spared">
            <p>Ce que Mireille ne voit pas, écrit aussi petit que l’importance que ça a pour elle :</p>
            <ul>
              <li>les pourcentages d’observance</li>
              <li>les alertes envoyées à son fils</li>
              <li>le stock de boîtes</li>
              <li>les réglages</li>
              <li>les graphiques</li>
            </ul>
          </aside>
        </section>

        {/* 9 h 00 · L'écran verrouillé de Naz */}
        <section id="proches" className="s-proches">
          <div className="s-proches-copy">
            <p className="s-proches-k">9 h 00 · Naz, son fils, à 40 minutes de chez elle</p>
            <h2>
              Il ne reçoit pas tout.
              <br />
              <em>Il reçoit ce qui compte.</em>
            </h2>
            <ol className="s-proches-steps">
              <li>
                <b>8 h 00</b> Le téléphone de Mireille parle.
              </li>
              <li>
                <b>8 h 30</b> Pas de réponse : il relance, plus fort. Personne d’autre n’est dérangé.
              </li>
              <li data-hot>
                <b>9 h 00</b> Toujours rien : Naz est prévenu.
              </li>
              <li>
                <b>9 h 10</b> Mireille a pris. L’alerte se ferme toute seule.
              </li>
            </ol>
          </div>
          <LockScreen />
        </section>

        {/* 12 h 30 · Le compte rendu du Dr Martin */}
        <section id="medecin" className="s-medecin">
          <p className="s-medecin-side">12 h 30 · Dr Martin, entre deux patients. Quinze minutes de consultation : il lui faut des faits, pas un journal.</p>
          <InView as="article" className="sheet">
            <header className="sheet-head">
              <div>
                <p className="sheet-cab">Cabinet du Dr Martin · médecine générale</p>
                <h2>Compte rendu d’observance</h2>
              </div>
              <dl>
                <dt>Patiente</dt>
                <dd>Mme Mireille Benali, 78 ans</dd>
                <dt>Période</dt>
                <dd>du vendredi 31 oct. au jeudi 6 nov.</dd>
                <dt>Suivie par</dt>
                <dd>Naz (fils), Sylvie (voisine)</dd>
              </dl>
            </header>
            <div className="sheet-body">
              <div className="sheet-big">
                <strong>82</strong>
                <span>%</span>
                <p>des prises faites sur 7 jours</p>
              </div>
              <div className="sheet-weekwrap">
              <table className="sheet-week">
                <thead>
                  <tr>
                    <th />
                    {WEEK.map((d) => (
                      <th key={d}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SHEET.map((r) => (
                    <tr key={r.label} data-note={r.note} style={{ ['--tone' as string]: r.tone }}>
                      <th>{r.label}</th>
                      {r.cells.split('').map((c, i) => (
                        <td key={i} data-c={c}>
                          {c === 'o' ? '×' : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <svg className="ink ink-circle" viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden="true">
                <path d="M12 44 C 20 8, 360 2, 388 30 C 404 52, 300 78, 160 74 C 60 72, 4 64, 14 38" />
              </svg>
              </div>
              <ul className="sheet-facts">
                <li>
                  <b>Collyre Travatan</b>, 21 h : oublié 3 fois sur 7
                </li>
                <li>
                  <b>Glycémie</b> avant l’insuline : une hypoglycémie (0,64 g/L), dimanche
                </li>
                <li>
                  <b>Ramipril</b> : 5 jours de stock, le fils est prévenu
                </li>
              </ul>
            </div>
            {/* Annotations à la main, à l'encre rouge */}
            <p className="ink ink-note">3 oublis le soir → conseil envoyé : « Gardez le collyre près de la brosse à dents. »</p>
            <p className="ink ink-stamp">Lu par la patiente</p>
          </InView>
        </section>

        {/* 15 h 00 · La notice */}
        <section id="notice" className="s-notice">
          <InView as="article" className="leaflet">
            <header className="leaflet-head">
              <p>Notice : information de l’utilisateur</p>
              <h2>
                MEDOC<sup>®</sup> pilulier partagé
              </h2>
              <p className="leaflet-sub">un dossier par famille · trois regards · usage quotidien</p>
            </header>
            <div className="leaflet-cols">
              <p className="leaflet-warn">Veuillez lire attentivement cette notice avant d’utiliser Medoc. Elle contient des informations importantes pour vous et pour votre famille. Gardez-la, vous pourriez avoir besoin de la relire.</p>
              <h3>1. Qu’est-ce que Medoc et dans quels cas est-il utilisé ?</h3>
              <p>Medoc est un pilulier qui parle. Il rappelle ses médicaments à la personne qui les prend, prévient ses proches si une prise est oubliée et donne à son médecin une vue claire de la semaine. Il est indiqué en cas de traitement long, de vue qui baisse, ou d’enfants qui s’inquiètent à distance.</p>
              <h3>2. Qui voit quoi ?</h3>
              <table className="leaflet-mx">
                <thead>
                  <tr>
                    <th>Information</th>
                    <th>Patiente</th>
                    <th>Proches</th>
                    <th>Médecin</th>
                  </tr>
                </thead>
                <tbody>
                  {MATRIX.map((m) => (
                    <tr key={m.what}>
                      <th>{m.what}</th>
                      <td>{m.p}</td>
                      <td>{m.f}</td>
                      <td>{m.d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="leaflet-legend">● au premier plan ○ consultable – épargné</p>
              <h3>3. Comment utiliser Medoc ?</h3>
              <p>
                <b>Posologie usuelle :</b> un dossier par famille. Le proche saisit ou scanne l’ordonnance ; rien n’y entre sans validation. Il invite ensuite le téléphone de la patiente et celui du médecin avec un code à usage unique, valable 48 heures.
              </p>
              <p>
                <b>Mode d’administration :</b> la patiente répond « J’ai pris », de la main ou de la voix. Si elle ne répond pas, le téléphone relance après 30 minutes, puis prévient les proches 30 minutes plus tard.
              </p>
              <p>
                <b>Si vous oubliez une prise :</b> ne doublez pas la suivante. Medoc vous le redira.
              </p>
              <h3>4. Quels sont les effets indésirables éventuels ?</h3>
              <p>
                <b>Très fréquents :</b> moins d’appels inquiets, des consultations plus courtes.
                <br />
                <b>Fréquents :</b> un fils qui pense enfin à autre chose.
                <br />
                <b>Rares :</b> une alerte la nuit. Elle attend en principe le réveil, sauf en cas de glycémie hors des seuils.
                <br />
                <b>Fréquence indéterminée :</b> la fierté d’avoir tout pris.
              </p>
              <h3>5. Comment conserver Medoc ?</h3>
              <p>Hors de portée des notifications inutiles. Fonctionne sans réseau : les rappels sonnent téléphone verrouillé, appli fermée, et les gestes partent au retour du réseau, sans doublon. Un accès retiré se coupe aussitôt.</p>
              <h3>6. Contenu de l’emballage</h3>
              <p>Un téléphone qui parle pour la patiente. Un écran calme pour les proches. Une tablette claire pour le médecin. Un seul dossier.</p>
              <p className="leaflet-end">Ce prototype ne remplace pas l’avis d’un médecin ou d’un pharmacien. L’ordonnance et les personnes sont fictives.</p>
            </div>
          </InView>
        </section>

        {/* 19 h 30 · À vous */}
        <section id="essayer" className="s-essayer">
          <div className="s-essayer-head">
            <p className="s-essayer-k">19 h 30 · à vous</p>
            <h2>
              Prenez la place
              <br />
              <em>de chacun.</em>
            </h2>
            <p className="s-essayer-lede">Un seul dossier, trois écrans, en direct. Prenez un médicament chez Mireille, avancez l’heure jusqu’à l’oubli, changez une dose chez le Dr Martin : tout suit, le pilulier aussi.</p>
          </div>
          <Prototype />
        </section>

        {/* 22 h 00 · Bonne nuit */}
        <section id="nuit" className="s-nuit">
          <div className="s-nuit-sky" aria-hidden="true">
            {Array.from({ length: 28 }, (_, i) => (
              <i key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 90}%`, animationDelay: `${(i % 7) * 0.6}s`, ['--tone' as string]: ['#ffd43b', '#ff9f43', '#6cb4ff', '#b69cff'][i % 4] }} />
            ))}
          </div>
          <p className="s-nuit-k">22 h 00</p>
          <h2>
            Bonne nuit,
            <br />
            <em>Maman.</em>
          </h2>
          <p className="s-nuit-p">Toutes les cases sont vides. C’était une bonne journée.</p>
          <a href="#reveil" className="s-nuit-cta">
            Rejouer la journée
          </a>
          <p className="s-nuit-foot">medoc · prototype. L’ordonnance et les personnes sont fictives ; Medoc ne remplace pas l’avis d’un médecin ou d’un pharmacien.</p>
        </section>
      </main>
    </StoreProvider>
  )
}
