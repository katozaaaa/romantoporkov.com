import { type Options as PugOptions, render } from 'pug'
import { dirname, relative, resolve, extname, normalize, basename } from 'path'
import fs from 'fs'
import { globSync } from 'glob'
import { normalizePath } from 'vite'
import type { Plugin, ResolvedConfig, HmrContext, Alias } from 'vite'
import pc from 'picocolors'

const { cyan, green } = pc

type PluginOptions = {
  pugOptions?: PugOptions
  locals?: Record<string, any>
  defaultPage: string
}

export const viteConvertPugInHtml = (
  options: PluginOptions = { defaultPage: 'index' }
): Plugin => {
  const htmlToPugMap = new Map<string, string>()
  let viteConfig: ResolvedConfig
  let viteAliases: Alias[] = []

  const pugAliasResolver = (filename: string, source?: string): string => {
    for (const alias of viteAliases) {
      const find =
        typeof alias.find === 'string'
          ? new RegExp(`^${alias.find}`)
          : alias.find
      if (find.test(filename)) {
        const aliasedPath = filename.replace(find, alias.replacement)
        if (fs.existsSync(aliasedPath)) return aliasedPath
        if (fs.existsSync(aliasedPath + '.pug')) return aliasedPath + '.pug'
      }
    }
    if (source) {
      const resolvedPath = resolve(dirname(source), filename)
      if (fs.existsSync(resolvedPath)) return resolvedPath
      if (
        extname(resolvedPath) !== '.pug' &&
        fs.existsSync(resolvedPath + '.pug')
      ) {
        return resolvedPath + '.pug'
      }
    }
    return filename
  }

  const renderPug = (filename: string, data: Record<string, any> = {}) => {
    const dependencies = new Set<string>()
    const dependencyTrackingPlugin = {
      lex(tokens: any[]) {
        if (!Array.isArray(tokens)) return tokens
        for (const token of tokens) {
          if (
            (token.type === 'include' || token.type === 'extends') &&
            token.file?.path
          ) {
            const depPath = pugAliasResolver(token.file.path, filename)
            if (fs.existsSync(depPath)) {
              dependencies.add(normalizePath(depPath))
            }
          }
        }
        return tokens
      }
    }
    const source = fs.readFileSync(filename, 'utf-8')
    const renderData = { ...options.locals, ...data }
    const html = render(source, {
      filename,
      basedir: viteConfig.root,
      pretty: true,
      ...options.pugOptions,
      ...renderData,
      plugins: [{ resolve: pugAliasResolver }, dependencyTrackingPlugin]
    })
    return { html, dependencies }
  }

  return {
    name: 'vite-convert-pug-in-html',
    enforce: 'pre',
    config(userConfig) {
      const root = normalizePath(resolve(process.cwd(), userConfig.root || ''))
      const pageFiles = globSync(`${root}/pages/**/*.pug`, {
        ignore: [`${root}/**/_*.pug`],
        absolute: true
      })
      const mainIndexFile = resolve(root, 'index.pug')
      const allPugFiles = [...pageFiles]
      if (fs.existsSync(mainIndexFile)) {
        allPugFiles.push(mainIndexFile)
      }
      const rollupInput: Record<string, string> = {}
      for (const pugPath of allPugFiles) {
        const normalizedPugPath = normalizePath(pugPath)
        const filenameWithoutExt = basename(
          normalizedPugPath,
          extname(normalizedPugPath)
        )
        const entryKey = normalizePath(filenameWithoutExt)
        const virtualHtmlPath = normalizePath(
          resolve(
            root,
            entryKey.endsWith(options.defaultPage)
              ? 'index.html'
              : `${entryKey}/index.html`
          )
        )
        rollupInput[entryKey] = virtualHtmlPath
        htmlToPugMap.set(virtualHtmlPath, normalizedPugPath)
      }
      return {
        build: {
          rollupOptions: {
            input: rollupInput
          }
        }
      }
    },
    configResolved(resolvedConfig: ResolvedConfig) {
      viteConfig = resolvedConfig
      viteAliases = resolvedConfig.resolve?.alias ?? []
    },
    resolveId(id) {
      if (htmlToPugMap.has(normalizePath(id))) {
        return normalizePath(id)
      }
      return null
    },
    load(id) {
      const pugPath = htmlToPugMap.get(normalizePath(id))
      if (pugPath && fs.existsSync(pugPath)) {
        try {
          const { html, dependencies } = renderPug(pugPath)
          for (const dep of dependencies) {
            this.addWatchFile(dep)
          }
          return html
        } catch (e) {
          this.error(e)
        }
      }
      return null
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (ctx.path.endsWith('.html')) {
          return html.replace(/data-script="(.+).js"/g, 'src="$1.js"')
        }
        return html
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '/'
        const requestPath = url.split('?')[0]
        if (requestPath.includes('.') && !requestPath.endsWith('.html'))
          return next()
        let pugPath
        let cleanPath = requestPath.slice(1)
        if (cleanPath === '' || requestPath.endsWith('/')) {
          cleanPath = cleanPath ? `${cleanPath}/index.html` : 'index.html'
        }
        let potentialHtmlPath = resolve(
          viteConfig.root,
          cleanPath.endsWith('.html') ? cleanPath : `${cleanPath}/index.html`
        )
        pugPath = htmlToPugMap.get(normalizePath(potentialHtmlPath))
        if (!pugPath && !cleanPath.endsWith('.html')) {
          potentialHtmlPath = resolve(viteConfig.root, `${cleanPath}.html`)
          pugPath = htmlToPugMap.get(normalizePath(potentialHtmlPath))
        }
        if (!pugPath) return next()
        try {
          const { html, dependencies } = renderPug(pugPath)
          for (const dep of dependencies) server.watcher.add(dep)
          const transformedHtml = await server.transformIndexHtml(
            url,
            html,
            req.originalUrl
          )
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html')
          res.end(transformedHtml)
        } catch (e) {
          next(e)
        }
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '/'
        const requestPath = url.split('?')[0]
        if (requestPath !== '/') return next()
        try {
          res.statusCode = 301
          res.setHeader('Location', `${options.defaultPage}`)
          res.end()
        } catch (e) {
          next(e)
        }
      })
    },
    handleHotUpdate({ file, server }: HmrContext): void {
      if (file.endsWith('.pug')) {
        server.config.logger.info(
          `${cyan('[vite-convert-pug-in-html]')}: Page reload ${green(normalize(relative(viteConfig.root, file)))}`,
          { timestamp: true }
        )
        server.ws.send({ type: 'full-reload', path: '*' })
      }
    }
  }
}
//# sourceMappingURL=index.js.map
