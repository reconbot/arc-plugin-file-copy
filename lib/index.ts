import { ensureDir, lstat, symlink, readlink, unlink as rmLink } from 'fs-extra'
import { updater } from '@architect/utils'
import { dirname, join } from 'path'

const logger = updater('file-copy', {})

const link = async (src: string, dest: string) => {
  try {
    const link = await readlink(dest)
    if (link == src) {
      return
    }
    await unlink(dest)
  } catch (error) {
    if (error.code === 'EINVAL') {
      throw new Error(`Target already exists "${dest}"`)
    }
    if (error.code !== 'ENOENT') {
      throw new Error(`Unknown Error ${error} reading ${dest}`)
    }
  }
  await ensureDir(dirname(dest))
  logger.status(`Linking ${src} -> ${dest}`)
  await symlink(src, dest)
}

const unlink = async (dest: string) => {
  try {
    const fileStat = await lstat(dest)
    if (!fileStat.isSymbolicLink()) {
      throw new Error(`Refusing to remove non symlink ${dest}`)
    }
  } catch {
    return
  }
  logger.status(`Unlinking ${dest}`)
  await rmLink(dest)
}

function getOptions(arc: { 'file-copy'?: string[][] }): { src: string, target: string }[] {
  if (!arc['file-copy']) {
    return []
  }
  const options: { src: string, target: string }[] = []
  for (const tuple of arc['file-copy']) {
    const [src, target] = tuple
    if (!src) {
      continue
    }
    if (!target) {
      continue
    }
    options.push({ src, target })
  }

  return options
}

const plugin = {
  deploy: {
    async start({ arc, cloudformation, inventory }) {
      if (!arc['file-copy']) {
        return cloudformation
      }

      const options = getOptions(arc)
      logger.start(`Linking ${options.length} paths`)
      const projectDir = inventory.inv._project.cwd as string

      for (const fun of Object.keys(cloudformation.Resources)) {
        const type = cloudformation.Resources[fun].Type
        if (type !== 'AWS::Serverless::Function' && type !== 'AWS::Lambda::Function') {
          continue
        }
        const uri = cloudformation.Resources[fun].Properties.CodeUri as string

        // some routes, like GetCatchallHTTPLambda, are built into arc (see npmjs.com/package/@architect/asap)
        if (uri.includes('node_modules')) {
          continue
        }

        for (const { src, target } of options) {
          await link(join(projectDir, src), join(uri, target))
        }
      }
      logger.done('All files linked')
      return cloudformation
    },
    async end({ arc, cloudformation }) {
      if (!arc['file-copy']) {
        return cloudformation
      }

      const options = getOptions(arc)
      logger.start(`Unlinking ${options.length} paths`)

      for (const fun of Object.keys(cloudformation.Resources)) {
        const type = cloudformation.Resources[fun].Type
        if (type !== 'AWS::Serverless::Function' && type !== 'AWS::Lambda::Function') {
          continue
        }
        const uri = cloudformation.Resources[fun].Properties.CodeUri as string

        // some routes, like GetCatchallHTTPLambda, are built into arc (see npmjs.com/package/@architect/asap)
        if (uri.includes('node_modules')) {
          continue
        }

        for (const { target } of options) {
          await unlink(join(uri, target))
        }
        logger.done('All files unlinked')
      }
      return cloudformation
    },
  },
  sandbox: {
    async start({ arc, inventory }) {
      const options = getOptions(arc)
      logger.start(`Linking ${options.length} paths`)
      const projectDir = inventory.inv._project.cwd as string
      for (const functionDir of Object.keys(inventory.inv.lambdasBySrcDir)) {
        for (const { src, target } of options) {
          await link(join(projectDir, src), join(functionDir, target))
        }
      }
      logger.done('All files linked')
    },
    async end({ inventory, arc }) {
      const options = getOptions(arc)
      logger.start(`Unlinking ${options.length} paths`)
      for (const functionDir of Object.keys(inventory.inv.lambdasBySrcDir)) {
        for (const { target } of options) {
          await unlink(join(functionDir, target))
        }
      }
      logger.done('All files unlinked')
    },
  },
}

export default plugin
