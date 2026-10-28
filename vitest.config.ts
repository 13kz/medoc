import { defineConfig } from 'vitest/config'

// Les heures de prise sont locales : on fixe le fuseau pour que les tests ne dépendent pas de la machine.
process.env.TZ = 'Europe/Paris'

export default defineConfig({
  test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
})
