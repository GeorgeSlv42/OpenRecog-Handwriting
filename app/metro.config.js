const path = require('node:path')
const fs = require('node:fs')
const { getDefaultConfig } = require('expo/metro-config')

// Expo's native DOM export renames assets to hashes. Keep this MVP's DOM bundle together
// so split common chunks do not retain references to the pre-rename filenames.
process.env.EXPO_NO_BUNDLE_SPLITTING = '1'
const config = getDefaultConfig(__dirname)
const excalidrawDirectory = path.dirname(require.resolve('@excalidraw/excalidraw'))
const stylesheet = fs.readFileSync(path.join(excalidrawDirectory, 'index.css'), 'utf8')
  .replace(/url\(["'](\.\/fonts\/[^"']+\.woff2)["']\)/g, (_, fontPath) =>
    `url("data:font/woff2;base64,${fs.readFileSync(path.join(excalidrawDirectory, fontPath)).toString('base64')}")`)
const cssFile = path.join(__dirname, '.expo', 'excalidraw', 'index.css')
fs.mkdirSync(path.dirname(cssFile), { recursive: true })
if (!fs.existsSync(cssFile) || fs.readFileSync(cssFile, 'utf8') !== stylesheet) fs.writeFileSync(cssFile, stylesheet)

// Excalidraw 0.18 exposes its CSS only under development/production export conditions.
// Metro also cannot import relative CSS font URLs; embed the shipped UI fonts for offline use.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@excalidraw/excalidraw/index.css') {
    return { type: 'sourceFile', filePath: cssFile }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
