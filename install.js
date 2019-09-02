/**
 * This script is run immediately after this package is installed
 * (or manually using `node install`). It installs any additional,
 * non-NPM, dependencies.
 *
 * This needs to be a `.js` file because `ts-node` is not installed
 * when this package is installed as a dependency.
 */

/* eslint-disable */

const path = require('path')

/**
 * A special `require()` like function that will load a compiled Javascript
 * module if it exists (in production) but fallback to transpiling Typescript
 * (in development).
 */
async function load(modulePath) {
  try {
    // If this succeeds then we are using
    // a distribution of the package where a
    // compiled Javascript file already exists
    return require(modulePath)
  } catch {
    // If we are here, then we are in development, but
    // the module has not yet been compiled to Javascript
    const childProcess = require('child_process')
    const util = require('util')
    const spawn = util.promisify(childProcess.spawn)
    await spawn('npx', ['tsc'], { stdio: 'inherit' })
    return require(modulePath)
  }
}

;(async () => {
  // Install Pandoc binary
  const pandoc = await load(path.join('.', 'dist', 'codecs', 'pandoc', 'binary'))
  await pandoc.install()
})()
