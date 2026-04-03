import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import type { Plugin } from 'vite'

// Dev-only plugin: serves the Edge Function locally so `npm run dev` works end-to-end
function edgeFunctionDevPlugin(): Plugin {
  return {
    name: 'edge-function-dev',
    configureServer(server) {
      // Helper: convert Node IncomingMessage → Web Request, invoke handler, stream response
      async function handleEdgeFunction(
        handlerPath: string,
        req: import('http').IncomingMessage,
        res: import('http').ServerResponse,
        method: string,
      ) {
        const mod = await server.ssrLoadModule(handlerPath)
        const handler = mod.default as (r: Request) => Promise<Response>

        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const body = Buffer.concat(chunks)

        const protocol = 'http'
        const host = req.headers.host ?? 'localhost'
        const url = `${protocol}://${host}${req.url ?? '/'}`
        const headers = new Headers()
        for (const [key, val] of Object.entries(req.headers)) {
          if (val) headers.set(key, Array.isArray(val) ? val.join(', ') : val)
        }

        const webReq = new Request(url, {
          method,
          headers,
          body: method === 'POST' ? body : undefined,
          // @ts-expect-error duplex required for streaming bodies in Node 18+
          duplex: 'half',
        })

        const webRes = await handler(webReq)

        res.statusCode = webRes.status
        webRes.headers.forEach((v, k) => res.setHeader(k, v))

        if (webRes.body) {
          const reader = webRes.body.getReader()
          const pump = async () => {
            while (true) {
              const { done, value } = await reader.read()
              if (done) { res.end(); return }
              res.write(value)
            }
          }
          await pump()
        } else {
          res.end(await webRes.text())
        }
      }

      server.middlewares.use('/api/text-inference', async (req, res) => {
        await handleEdgeFunction('/api/text-inference.ts', req, res, req.method ?? 'POST')
      })

      server.middlewares.use('/api/models', async (req, res) => {
        await handleEdgeFunction('/api/models.ts', req, res, req.method ?? 'GET')
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), edgeFunctionDevPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
