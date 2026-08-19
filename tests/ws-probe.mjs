import crypto from 'node:crypto'
import net from 'node:net'
import tls from 'node:tls'

const [urlText, expectedText = '101'] = process.argv.slice(2)
if (!urlText) {
  console.error('usage: node tests/ws-probe.mjs <ws[s]://url> [expected-status]')
  process.exit(2)
}

const url = new URL(urlText)
const secure = url.protocol === 'wss:'
if (!secure && url.protocol !== 'ws:') throw new Error('URL must use ws: or wss:')
const port = Number(url.port || (secure ? 443 : 80))
const expected = Number(expectedText)
const key = crypto.randomBytes(16).toString('base64')
const host = url.port ? `${url.hostname}:${url.port}` : url.hostname
const origin = `${secure ? 'https' : 'http'}://${host}`
const request = [
  `GET ${url.pathname}${url.search} HTTP/1.1`,
  `Host: ${host}`,
  `Origin: ${origin}`,
  'Connection: Upgrade',
  'Upgrade: websocket',
  'Sec-WebSocket-Version: 13',
  `Sec-WebSocket-Key: ${key}`,
  '',
  '',
].join('\r\n')

const socket = secure
  ? tls.connect({ host: url.hostname, port, servername: url.hostname })
  : net.connect({ host: url.hostname, port })

socket.setTimeout(10_000)
socket.once(secure ? 'secureConnect' : 'connect', () => socket.write(request))
socket.once('timeout', () => socket.destroy(new Error('upgrade timed out')))
socket.once('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})

let response = ''
socket.on('data', (chunk) => {
  response += chunk.toString('latin1')
  const end = response.indexOf('\r\n')
  if (end === -1) return
  const match = /^HTTP\/1\.[01] (\d{3})/.exec(response.slice(0, end))
  const status = match ? Number(match[1]) : 0
  socket.end()
  if (status !== expected) {
    console.error(`expected ${expected}, got ${status || 'invalid response'}`)
    process.exitCode = 1
  }
})
