// Audit d'accessibilité (axe-core) des écrans principaux des trois rôles.
// Usage : npm run build && npm run test:a11y. Échoue sur toute violation sérieuse ou critique.
import AxeBuilder from '@axe-core/playwright'
import { chromium } from 'playwright'
import { preview } from 'vite'

const server = await preview({ preview: { port: 4174, strictPort: true }, logLevel: 'warn' })
const url = 'http://localhost:4174/'

/** Chaque scénario prépare l'état, choisit l'appareil et ouvre éventuellement un écran. */
const SCENARIOS = [
  { name: 'patient, gros caractères', view: 'patient', time: '08:05', steps: ['.unlock'] },
  { name: 'patient, voix d’abord', view: 'patient', time: '08:05', mode: 'voix', steps: ['.unlock'] },
  { name: 'patient, standard', view: 'patient', time: '12:00', mode: 'standard', steps: ['.unlock'] },
  { name: 'patient, glycémie', view: 'patient', time: '22:01', allTakenBefore: '22:00', steps: ['.unlock'] },
  { name: 'aidant, aujourd’hui', view: 'aidant', time: '09:10' },
  { name: 'aidant, ordonnance', view: 'aidant', time: '09:10', steps: ['.cg-tabs button:nth-child(2)'] },
  { name: 'aidant, éditeur', view: 'aidant', time: '09:10', steps: ['.cg-tabs button:nth-child(2)', '.cg-med-btn'] },
  { name: 'aidant, alertes', view: 'aidant', time: '09:10', steps: ['.cg-tabs button:nth-child(3)'] },
  { name: 'aidant, réglages', view: 'aidant', time: '09:10', steps: ['.cg-tabs button:nth-child(4)'] },
  { name: 'aidant, historique', view: 'aidant', time: '09:10', steps: ['.cg-week .ghost'] },
  { name: 'médecin', view: 'medecin', time: '09:10' },
  { name: 'aidant, scan d’ordonnance', view: 'aidant', time: '09:10', steps: ['.cg-tabs button:nth-child(2)', '.cg-section-head + .secondary'] },
  {
    name: 'aidant, relecture du scan',
    view: 'aidant',
    time: '09:10',
    steps: ['.cg-tabs button:nth-child(2)', '.cg-section-head + .secondary', { fill: '#scan-text', text: 'Levothyrox 75 µg\nselon bilan\nAmoxicilline 1 g : 1 cp 2 fois par jour pendant 7 jours' }, '.scan .secondary.block:last-of-type'],
  },
  { name: 'aidant installé, partage', view: 'aidant', time: '09:10', path: 'aidant', steps: ['.cg-tabs button:nth-child(4)'] },
  { name: 'rejoindre un dossier', view: 'patient', time: '09:10', path: 'rejoindre?invitation=ABCD2345' },
]

const browser = await chromium.launch()
let failures = 0
for (const sc of SCENARIOS) {
  const context = await browser.newContext({ viewport: { width: 1300, height: 950 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto(url)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.evaluate((sc) => {
    const s = JSON.parse(localStorage.getItem('medoc:v1'))
    const [h, m] = sc.time.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    s.clock = { offsetMs: d.getTime() - Date.now(), speed: 1, anchorMs: Date.now() }
    if (sc.mode) s.patient.displayMode = sc.mode
    if (sc.allTakenBefore) {
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      for (const med of s.medications)
        for (const t of med.times) if (t < sc.allTakenBefore) s.intakes[`${day}|${med.id}|${t}`] = { takenAt: d.toISOString(), by: 'patient' }
    }
    localStorage.setItem('medoc:v1', JSON.stringify(s))
    localStorage.setItem('medoc:view', sc.view)
  }, sc)
  if (sc.path) await page.goto(url + sc.path)
  else await page.reload()
  await page.waitForTimeout(600)
  for (const sel of sc.steps ?? []) {
    if (typeof sel === 'object') {
      await page.locator(sel.fill).fill(sel.text)
      continue
    }
    await page.locator(sel).first().click()
    await page.waitForTimeout(300)
  }
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  const minor = violations.length - serious.length
  console.log(`${serious.length ? '✗' : '✓'} ${sc.name}${minor ? ` (${minor} mineure${minor > 1 ? 's' : ''})` : ''}`)
  for (const v of serious) {
    console.log(`  ${v.impact} ${v.id} : ${v.help}`)
    for (const n of v.nodes.slice(0, 4)) console.log(`    ${n.target.join(' ')}  ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`)
  }
  failures += serious.length
  await context.close()
}
await browser.close()
server.httpServer.close()
process.exit(failures ? 1 : 0)
