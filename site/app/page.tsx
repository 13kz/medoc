import { LiveBox } from '@/components/LiveBox'
import { Prototype } from '@/components/proto/Prototype'
import { HeroParallax, Logo, Nav, Reveal } from '@/components/Reveal'
import { StoreProvider } from '@/lib/store'

const ROLES = [
  {
    id: 'patient',
    kicker: 'La patiente',
    name: 'Mireille, 78 ans',
    line: 'Diabète, glaucome, tension. Elle voit mal et n’a pas envie d’une appli.',
    knows: ['Ce qu’il faut prendre maintenant, lu à voix haute', 'Comment le prendre : pendant le repas, dans chaque œil', 'Le conseil du médecin, avec ses mots'],
    spared: ['Les pourcentages', 'Les alertes envoyées aux proches', 'Le stock et les renouvellements'],
  },
  {
    id: 'proches',
    kicker: 'Les proches',
    name: 'Naz, son fils',
    line: 'Il habite à 40 minutes. Il veut savoir que tout va bien, sans appeler trois fois par jour.',
    knows: ['Tout va bien, ou pas : en une phrase', 'Une alerte seulement si Maman ne répond pas à la relance', 'Quand racheter une boîte'],
    spared: ['Les relances qui ont suffi', 'Les réglages cliniques', 'Le détail de la glycémie, sauf si elle sort des seuils'],
  },
  {
    id: 'medecin',
    kicker: 'Le médecin',
    name: 'Dr Martin, généraliste',
    line: 'Quinze minutes de consultation. Il a besoin de faits, pas d’un journal.',
    knows: ['L’observance sur 7 jours, patient par patient', 'Les oublis qui se répètent, la glycémie', 'Le traitement, modifiable, et le conseil lu au patient'],
    spared: ['Les notifications du quotidien', 'Les « plus tard » et les reports', 'Les réglages de la famille'],
  },
]

const MATRIX: { what: string; p: 0 | 1 | 2; f: 0 | 1 | 2; d: 0 | 1 | 2 }[] = [
  { what: 'La prise du moment, lue à voix haute', p: 2, f: 1, d: 0 },
  { what: 'Les consignes de prise', p: 2, f: 1, d: 1 },
  { what: 'Tout va bien ? En une phrase', p: 0, f: 2, d: 0 },
  { what: 'Alerte quand une prise est oubliée', p: 0, f: 2, d: 0 },
  { what: 'Stock et renouvellement', p: 0, f: 2, d: 0 },
  { what: 'Réglage du téléphone du patient', p: 0, f: 2, d: 0 },
  { what: 'Observance sur 7 jours', p: 0, f: 1, d: 2 },
  { what: 'Oublis répétés, glycémie', p: 0, f: 1, d: 2 },
  { what: 'Modifier l’ordonnance', p: 0, f: 1, d: 2 },
  { what: 'Conseil du médecin', p: 2, f: 1, d: 2 },
]

const DAY = [
  { t: '8 h 00', title: 'Le téléphone parle', text: '« Bonjour Maman. C’est l’heure de la Metformine et du Ramipril, pendant le petit déjeuner. » Un seul bouton : J’ai pris.', tone: '#ffd43b' },
  { t: '8 h 30', title: 'Une relance, en douceur', text: 'Pas de réponse. Le téléphone redit la consigne, plus fort. Personne d’autre n’est dérangé.', tone: '#ffd43b' },
  { t: '9 h 00', title: 'Naz est prévenu', text: '« Maman n’a pas encore pris Ramipril (prévu à 8 h). » Il peut appeler, ou noter qu’il l’a vue le prendre.', tone: '#ff9f43' },
  { t: '9 h 10', title: 'L’alerte se ferme seule', text: 'Mireille a pris. La notification de Naz devient : « Maman a pris Ramipril à 9 h 10. » Fin de l’inquiétude.', tone: '#7fd6a4' },
  { t: 'Vendredi', title: 'La consultation', text: 'Le Dr Martin voit que le collyre du soir est oublié 3 fois sur 7. Il envoie un conseil : il sera lu à Mireille ce soir.', tone: '#6cb4ff' },
]

const TRUST = [
  { title: 'Un dossier par famille', text: 'Le patient, ses proches et son médecin partagent un seul dossier. Chacun y entre avec un code d’invitation, et un accès retiré se coupe aussitôt.' },
  { title: 'Personne n’est noyé', text: 'Le médecin ne reçoit aucune alerte du quotidien. Les proches, seulement quand la relance n’a pas suffi. La nuit, les alertes attendent le réveil.' },
  { title: 'Rien ne change sans validation', text: 'Une ordonnance scannée est une proposition. Chaque changement de traitement est nommé, daté, et expliqué au patient avec ses mots.' },
  { title: 'Même sans réseau', text: 'Les rappels sonnent téléphone verrouillé et appli fermée. Les gestes faits hors ligne partent au retour du réseau, sans doublon.' },
]

const Dot = ({ v }: { v: 0 | 1 | 2 }) => <span className="mx-dot" data-v={v} aria-label={v === 2 ? 'Oui, en premier' : v === 1 ? 'En lecture' : 'Non'} />

export default function Home() {
  return (
    <StoreProvider>
      <Nav />
      <main id="top">
        <section className="hero">
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-text">
            <Reveal>
              <p className="eyebrow">
                <span className="eyebrow-dots" aria-hidden="true">
                  <i style={{ background: '#ffd43b' }} />
                  <i style={{ background: '#ff9f43' }} />
                  <i style={{ background: '#6cb4ff' }} />
                  <i style={{ background: '#b69cff' }} />
                </span>
                Le pilulier connecté
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <h1>
                Un pilulier.
                <br />
                <em>Trois regards.</em>
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="hero-lede">
                Medoc rappelle ses médicaments à la personne qui les prend, rassure ses enfants et donne au médecin ce qui compte. Chacun voit ce qu’il doit savoir. Rien de plus.
              </p>
            </Reveal>
            <Reveal delay={0.24} className="hero-ctas">
              <a href="#prototype" className="btn btn-primary">
                Essayer le prototype
              </a>
              <a href="#regards" className="btn btn-ghost">
                Qui voit quoi ?
              </a>
            </Reveal>
          </div>
          <HeroParallax className="hero-box">
            <LiveBox className="hero-canvas" interactive={false} camera={[0, 6.6, 7.8]} />
            <ul className="hero-legend" aria-label="Les quatre couvercles">
              <li style={{ ['--tone' as string]: '#ffd43b' }}>Matin</li>
              <li style={{ ['--tone' as string]: '#ff9f43' }}>Midi</li>
              <li style={{ ['--tone' as string]: '#6cb4ff' }}>Soir</li>
              <li style={{ ['--tone' as string]: '#b69cff' }}>Coucher</li>
            </ul>
          </HeroParallax>
          <a href="#regards" className="hero-scroll" aria-label="Descendre">
            <span />
          </a>
        </section>

        <section className="band" aria-label="En bref">
          <div className="band-track">
            {Array.from({ length: 2 }, (_, k) => (
              <div key={k} className="band-row" aria-hidden={k === 1}>
                <span>Une seule chose à faire à la fois</span>
                <i />
                <span>Lu à voix haute</span>
                <i />
                <span>Jaune sur noir pour la basse vision</span>
                <i />
                <span>Alertes en deux temps</span>
                <i />
                <span>Observance sur 7 jours</span>
                <i />
                <span>Stock et renouvellement</span>
                <i />
                <span>Conseils du médecin lus au patient</span>
                <i />
              </div>
            ))}
          </div>
        </section>

        <section id="regards" className="sec sec-light">
          <div className="sec-head">
            <Reveal>
              <p className="eyebrow eyebrow-dark">Trois regards</p>
              <h2>
                Le même pilulier,
                <br />
                <em>trois vérités utiles.</em>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="sec-lede">
                Une appli qui montre tout à tout le monde n’aide personne. Medoc part d’une seule ordonnance et la raconte trois fois : au geste pour la patiente, à la tranquillité pour ses enfants, aux faits pour le médecin.
              </p>
            </Reveal>
          </div>
          <div className="roles">
            {ROLES.map((r, i) => (
              <Reveal key={r.id} delay={i * 0.08} className="role" y={40}>
                <article data-role={r.id}>
                  <p className="role-kicker">{r.kicker}</p>
                  <h3>{r.name}</h3>
                  <p className="role-line">{r.line}</p>
                  <p className="role-h">Ce qu’on lui dit</p>
                  <ul className="role-knows">
                    {r.knows.map((k) => (
                      <li key={k}>{k}</li>
                    ))}
                  </ul>
                  <p className="role-h">Ce qu’on lui épargne</p>
                  <ul className="role-spared">
                    {r.spared.map((k) => (
                      <li key={k}>{k}</li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>
          <Reveal className="mx-wrap">
            <table className="mx">
              <caption>Qui voit quoi</caption>
              <thead>
                <tr>
                  <th scope="col">Information</th>
                  <th scope="col" data-role="patient">
                    Patiente
                  </th>
                  <th scope="col" data-role="proches">
                    Proches
                  </th>
                  <th scope="col" data-role="medecin">
                    Médecin
                  </th>
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((m) => (
                  <tr key={m.what}>
                    <th scope="row">{m.what}</th>
                    <td>
                      <Dot v={m.p} />
                    </td>
                    <td>
                      <Dot v={m.f} />
                    </td>
                    <td>
                      <Dot v={m.d} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mx-legend">
              <span>
                <Dot v={2} /> au premier plan
              </span>
              <span>
                <Dot v={1} /> consultable
              </span>
              <span>
                <Dot v={0} /> épargné
              </span>
            </p>
          </Reveal>
        </section>

        <section id="prototype" className="sec sec-stage">
          <div className="sec-head sec-head-center">
            <Reveal>
              <p className="eyebrow">Prototype interactif</p>
              <h2>
                Prenez la place
                <br />
                <em>de chacun.</em>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="sec-lede">
                Un seul dossier, en direct. Prenez un médicament sur le téléphone de Mireille, avancez l’heure jusqu’à l’oubli, modifiez une dose chez le Dr Martin : les trois écrans et le pilulier suivent.
              </p>
            </Reveal>
          </div>
          <Prototype />
        </section>

        <section id="journee" className="sec sec-light">
          <div className="sec-head">
            <Reveal>
              <p className="eyebrow eyebrow-dark">Une journée</p>
              <h2>
                Des alertes
                <br />
                <em>en deux temps.</em>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="sec-lede">D’abord la patiente, ensuite les proches. Un oubli n’affole personne, et une alerte se ferme d’elle-même quand la prise est faite.</p>
            </Reveal>
          </div>
          <ol className="day">
            {DAY.map((s, i) => (
              <Reveal key={s.t} delay={i * 0.07} className="day-step" y={30}>
                <li style={{ ['--tone' as string]: s.tone }}>
                  <span className="day-t">{s.t}</span>
                  <span className="day-dot" />
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </section>

        <section id="vision" className="sec sec-dark">
          <div className="sec-head">
            <Reveal>
              <p className="eyebrow">Basse vision</p>
              <h2>
                Dessiné pour les yeux
                <br />
                <em>qui fatiguent.</em>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="sec-lede">
                Atkinson Hyperlegible, une police conçue pour les malvoyants. Jaune sur noir, qui éblouit moins avec une cataracte. Et pour qui ne voit plus : la voix d’abord, deux zones géantes. L’affichage se règle depuis le téléphone d’un proche.
              </p>
            </Reveal>
          </div>
          <div className="modes">
            <Reveal className="mode" delay={0}>
              <div className="mode-phone mode-voice">
                <p className="mode-small">2 médicaments à prendre</p>
                <span className="mode-zone mode-zone-a">Répéter</span>
                <span className="mode-zone mode-zone-b">C’est pris</span>
              </div>
              <h3>Voix d’abord</h3>
              <p>Pour une personne qui ne voit pas. L’écran entier est un bouton.</p>
            </Reveal>
            <Reveal className="mode" delay={0.08}>
              <div className="mode-phone mode-big">
                <p className="mode-small">C’est l’heure</p>
                <p className="mode-huge">Metformine</p>
                <p className="mode-mid">1 comprimé · pendant le repas</p>
                <span className="mode-take">J’ai pris</span>
              </div>
              <h3>Gros caractères</h3>
              <p>Cataracte, glaucome, DMLA. Une chose à la fois, en très grand.</p>
            </Reveal>
            <Reveal className="mode" delay={0.16}>
              <div className="mode-phone mode-std">
                <p className="mode-small">Aujourd’hui</p>
                {['8 h · Metformine', '8 h · Ramipril', '12 h 30 · Kardégic', '19 h 30 · Atorvastatine'].map((x, i) => (
                  <p key={x} className="mode-row">
                    <i data-on={i < 2} /> {x}
                  </p>
                ))}
              </div>
              <h3>Standard</h3>
              <p>Pour qui voit bien : la journée entière, avec des cases à cocher.</p>
            </Reveal>
          </div>
        </section>

        <section className="sec sec-light">
          <div className="sec-head">
            <Reveal>
              <p className="eyebrow eyebrow-dark">Confiance</p>
              <h2>
                Sérieux comme
                <br />
                <em>une ordonnance.</em>
              </h2>
            </Reveal>
          </div>
          <div className="trust">
            {TRUST.map((t, i) => (
              <Reveal key={t.title} delay={i * 0.06} className="trust-item">
                <span className="trust-n">0{i + 1}</span>
                <h3>{t.title}</h3>
                <p>{t.text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="outro">
          <Reveal>
            <Logo size={56} />
            <h2>
              Chacun sa case.
              <br />
              <em>Tout le monde rassuré.</em>
            </h2>
            <a href="#prototype" className="btn btn-primary">
              Rejouer la journée
            </a>
          </Reveal>
        </section>
      </main>
      <footer className="foot">
        <p>
          <strong>medoc</strong> · prototype. L’ordonnance et les personnes sont fictives ; Medoc ne remplace pas l’avis d’un médecin ou d’un pharmacien.
        </p>
      </footer>
    </StoreProvider>
  )
}
