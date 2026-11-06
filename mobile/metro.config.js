// Metro lit aussi `src/lib` à la racine du dépôt : la logique métier (prises, réducteur, alertes,
// rappels, synchronisation) est la même pour le web, le serveur et l'appli native.
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const root = path.resolve(__dirname, '..')
const config = getDefaultConfig(__dirname)

config.watchFolders = [path.join(root, 'src')]
// Le code partagé n'importe aucun paquet npm ; s'il le faisait, il prendrait ceux de l'appli native.
config.resolver.nodeModulesPaths = [path.join(__dirname, 'node_modules')]

module.exports = config
