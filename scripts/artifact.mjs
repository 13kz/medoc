// Transforme dist-single/index.html en page d'Artifact claude.ai (sans squelette html/head/body).
import { readFileSync, writeFileSync } from 'node:fs'

const html = readFileSync(process.argv[2] ?? 'dist-single/index.html', 'utf8')
const pick = (re) => [...html.matchAll(re)].map((m) => m[0]).join('\n')
const title = html.match(/<title>.*?<\/title>/s)?.[0] ?? '<title>Medoc</title>'
const fonts = pick(/<link rel="(?:preconnect|stylesheet)"[^>]*>/g)
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g)
const scripts = pick(/<script[^>]*>[\s\S]*?<\/script>/g)
const out = `${title}\n<meta name="theme-color" content="#101418">\n${fonts}\n${styles}\n<div id="root"></div>\n${scripts}\n`
writeFileSync(process.argv[3] ?? 'dist-single/artifact.html', out)
console.log('ok', out.length)
