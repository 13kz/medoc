import { createSyncServer } from './sync-server'

// Les heures de prise sont des heures locales : le serveur doit tourner dans le fuseau du patient (TZ).
const port = Number(process.argv[2] ?? process.env.PORT ?? 8787)
createSyncServer({ dataDir: process.env.MEDOC_DATA ?? 'data' }).listen(port, () => {
  console.log(`Medoc, serveur de synchronisation sur http://localhost:${port}`)
})
