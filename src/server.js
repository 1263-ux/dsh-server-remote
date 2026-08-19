import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const DEFAULT_LISTEN_HOST = '127.0.0.1'
const DEFAULT_LISTEN_PORT = 3090
const DEFAULT_UPSTREAM_HOST = '127.0.0.1'
const DEFAULT_UPSTREAM_PORT = 3080

export function createGateway(options = {}) {
  const listenHost = options.listenHost ?? DEFAULT_LISTEN_HOST
  const listenPort = options.listenPort ?? DEFAULT_LISTEN_PORT
  const upstreamHost = options.upstreamHost ?? DEFAULT_UPSTREAM_HOST
  const upstreamPort = options.upstreamPort ?? DEFAULT_UPSTREAM_PORT
  const upstreamAuthority = `${upstreamHost}:${upstreamPort}`
  const upstreamOrigin = `http://${upstreamAuthority}`

  if (!isLoopbackHost(listenHost)) {
    throw new Error(`PoC gateway must listen on loopback, got ${listenHost}`)
  }

  const upgradedSockets = new Set()
  const requestHandler = (request, response) => {
    const headers = rewriteHeaders(request.headers, upstreamAuthority, upstreamOrigin)
    const upstream = http.request({
      host: upstreamHost,
      port: upstreamPort,
      method: request.method,
      path: request.url,
      headers,
    }, (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers)
      upstreamResponse.pipe(response)
    })

    upstream.on('error', (error) => {
      if (!response.headersSent) {
        response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
      }
      response.end(`upstream unavailable: ${error.message}`)
    })

    request.on('aborted', () => upstream.destroy())
    request.pipe(upstream)
  }

  const server = options.tls
    ? https.createServer({
        ...(options.tls.pfx ? {
          pfx: fs.readFileSync(options.tls.pfx),
          passphrase: options.tls.passphrase,
        } : {
          key: fs.readFileSync(options.tls.key),
          cert: fs.readFileSync(options.tls.cert),
        }),
      }, requestHandler)
    : http.createServer(requestHandler)

  server.on('upgrade', (request, socket, head) => {
    const upstream = net.connect(upstreamPort, upstreamHost)
    upgradedSockets.add(socket)
    socket.once('close', () => upgradedSockets.delete(socket))

    upstream.once('connect', () => {
      const headers = rewriteHeaders(request.headers, upstreamAuthority, upstreamOrigin)
      upstream.write(serializeUpgradeRequest(request, headers))
      if (head.length > 0) upstream.write(head)
      socket.pipe(upstream).pipe(socket)
    })

    upstream.on('error', () => {
      if (!socket.destroyed) {
        socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
      }
    })

    socket.on('error', () => upstream.destroy())
    socket.on('close', () => upstream.destroy())
    upstream.on('close', () => socket.destroy())
  })

  return {
    server,
    listen() {
      return new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(listenPort, listenHost, () => {
          server.off('error', reject)
          resolve(server.address())
        })
      })
    },
    close() {
      return new Promise((resolve, reject) => {
        for (const socket of upgradedSockets) socket.destroy()
        server.closeAllConnections()
        server.close((error) => error ? reject(error) : resolve())
      })
    },
  }
}

export function rewriteHeaders(headers, upstreamAuthority, upstreamOrigin) {
  const rewritten = { ...headers, host: upstreamAuthority }
  delete rewritten['proxy-connection']
  delete rewritten['x-forwarded-host']
  delete rewritten['x-forwarded-proto']
  delete rewritten['x-forwarded-port']
  if (headers.origin !== undefined) rewritten.origin = upstreamOrigin
  return rewritten
}

function serializeUpgradeRequest(request, headers) {
  const lines = [`${request.method ?? 'GET'} ${request.url ?? '/'} HTTP/${request.httpVersion}`]
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value) lines.push(`${name}: ${item}`)
    } else {
      lines.push(`${name}: ${value}`)
    }
  }
  return `${lines.join('\r\n')}\r\n\r\n`
}

function isLoopbackHost(host) {
  return host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host)
}

async function main() {
  const gateway = createGateway({
    listenHost: process.env.GATEWAY_HOST,
    listenPort: parsePort(process.env.GATEWAY_PORT, DEFAULT_LISTEN_PORT),
    upstreamHost: process.env.DSH_HOST,
    upstreamPort: parsePort(process.env.DSH_PORT, DEFAULT_UPSTREAM_PORT),
    tls: process.env.GATEWAY_TLS_PFX
      ? { pfx: process.env.GATEWAY_TLS_PFX, passphrase: process.env.GATEWAY_TLS_PASSPHRASE ?? '' }
      : process.env.GATEWAY_TLS_KEY && process.env.GATEWAY_TLS_CERT
        ? { key: process.env.GATEWAY_TLS_KEY, cert: process.env.GATEWAY_TLS_CERT }
        : undefined,
  })
  const address = await gateway.listen()
  const scheme = process.env.GATEWAY_TLS_PFX || (process.env.GATEWAY_TLS_KEY && process.env.GATEWAY_TLS_CERT) ? 'https' : 'http'
  console.log(`DSH Gateway PoC listening at ${scheme}://${address.address}:${address.port}`)

  const stop = async () => {
    await gateway.close()
    process.exit(0)
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}

function parsePort(value, fallback) {
  if (value === undefined || value === '') return fallback
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`invalid port: ${value}`)
  }
  return port
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
