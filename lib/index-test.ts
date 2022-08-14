import { assert } from 'chai'
import makeInventory from '@architect/inventory'
import pkg from '@architect/package'
import { copy, mkdirp, remove } from 'fs-extra'
import fs from 'fs'
import { join } from 'path'
import globStandard from 'glob'
import { promisify } from 'util'
import plugin from './'

const glob = promisify(globStandard)

const sampleDir = join(__dirname, '..', 'sample-app')
const appDir = join(__dirname, '..', 'tmp')
const originalCwd = process.cwd()

// TODO: remove the necessity of building the plugin before running tests

describe('arc-plugin-esbuild', () => {
  before(async () => {
    // Set up integration test directory as a copy of sample app
    await remove(appDir)
    await mkdirp(appDir)
    await copy(sampleDir, appDir)

    const appPluginDir = join(appDir, 'node_modules', 'arc-plugin-file-copy')
    await mkdirp(appPluginDir)
    await copy(join(__dirname, '..', 'dist'), appPluginDir)
    process.chdir(appDir)
  })

  after(async () => {
    process.chdir(originalCwd)
  })

  describe('arguments', () => {
    it('parses the arguments', async () => {
      const inventory = await makeInventory({ deployStage: 'production' })
      const arc = inventory.inv._project.arc
      assert.deepEqual(arc['file-copy'], [
        ['settings.json', 'settings.json'],
        ['settings.json', 'data.json'],
        ['data', 'data'],
        ['public/app.css', 'files/example.css'],
      ])
    })
  })

  describe('packaging', () => {
    it('changes the code uri from a `src/` path to a `dist` path', async () => {
      const inventory = await makeInventory({ deployStage: 'production' })
      const arc = inventory.inv._project.arc
      const cloudformation = pkg(inventory)

      const result = await plugin.deploy.start({ arc, cloudformation, inventory })
      const code = result.Resources.FooEventLambda.Properties.CodeUri
      // make sure files are there
      await plugin.deploy.end({ arc, cloudformation })
    })
  })

  describe('sandbox integration', () => {
    beforeEach(function () {
      this.timeout(15000)
    })

    it('compiles function typescript code into JS on startup and removes compiled JS on shutdown', async () => {
      const inventory = await makeInventory({ deployStage: 'production' })
      const arc = inventory.inv._project.arc

      await plugin.sandbox.start({ arc, inventory })

      await plugin.sandbox.end({ arc, inventory })
    })
  })
})
