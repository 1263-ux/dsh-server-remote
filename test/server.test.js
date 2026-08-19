import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import net from 'node:net'
import { createGateway, rewriteHeaders } from '../src/server.js'

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address())))
}

function close(server) {
  server.closeAllConnections()
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

test('rewrites DSH authority headers and preserves browser fetch metadata', () => {
  const headers = rewriteHeaders({
    host: 'dsh.test:3090',
    origin: 'http://dsh.test:3090',
    'sec-fetch-site': 'same-origin',
    'x-forwarded-host': 'dsh.test:3090',
  }, '127.0.0.1:3080', 'http://127.0.0.1:3080')

  assert.equal(headers.host, '127.0.0.1:3080')
  assert.equal(headers.origin, 'http://127.0.0.1:3080')
  assert.equal(headers['sec-fetch-site'], 'same-origin')
  assert.equal(headers['x-forwarded-host'], undefined)
})

test('streams HTTP response through the gateway', async (t) => {
  const upstream = http.createServer((request, response) => {
    assert.equal(request.headers.host, `127.0.0.1:${upstreamAddress.port}`)
    assert.equal(request.headers.origin, `http://127.0.0.1:${upstreamAddress.port}`)
    response.writeHead(200, { 'content-type': 'text/plain' })
    response.write('first')
    setTimeout(() => response.end(' second'), 25)
  })
  const upstreamAddress = await listen(upstream)
  const gateway = createGateway({ upstreamPort: upstreamAddress.port, listenPort: 0 })
  const gatewayAddress = await gateway.listen()
  t.after(async () => {
    await gateway.close()
    await close(upstream)
  })

  const chunks = []
  await new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1',
      port: gatewayAddress.port,
      path: '/stream',
      headers: { origin: 'http://dsh.test', connection: 'close' },
    }, (response) => {
      response.on('data', (chunk) => chunks.push(chunk.toString()))
      response.on('end', resolve)
    })
    request.on('error', reject)
    request.end()
  })

  assert.deepEqual(chunks, ['first', ' second'])
})

test('tunnels WebSocket upgrade and frames', async (t) => {
  const upstream = http.createServer()
  const upstreamSockets = new Set()
  upstream.on('upgrade', (request, socket) => {
    upstreamSockets.add(socket)
    socket.once('close', () => upstreamSockets.delete(socket))
    assert.equal(request.headers.host, `127.0.0.1:${upstreamAddress.port}`)
    assert.equal(request.headers.origin, `http://127.0.0.1:${upstreamAddress.port}`)
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Connection: Upgrade',
      'Upgrade: websocket',
      '',
      '',
    ].join('\r\n'))
    socket.once('data', (data) => socket.write(data))
  })
  const upstreamAddress = await listen(upstream)
  const gateway = createGateway({ upstreamPort: upstreamAddress.port, listenPort: 0 })
  const gatewayAddress = await gateway.listen()
  t.after(async () => {
    await gateway.close()
    for (const socket of upstreamSockets) socket.destroy()
    await close(upstream)
  })

  const response = await new Promise((resolve, reject) => {
    let settled = false
    let timer
    const finish = (error, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error)
      else resolve(value)
    }
    const socket = net.connect(gatewayAddress.port, '127.0.0.1', () => {
      socket.write([
        'GET /api/events.mux HTTP/1.1',
        `Host: dsh.test:${gatewayAddress.port}`,
        'Origin: http://dsh.test',
        'Connection: Upgrade',
        'Upgrade: websocket',
        'Sec-WebSocket-Version: 13',
        'Sec-WebSocket-Key: cG9jLXRlc3Q=',
        '',
        '',
      ].join('\r\n'))
    })
    const chunks = []
    socket.on('data', (chunk) => {
      chunks.push(chunk)
      if (Buffer.concat(chunks).includes(Buffer.from('echo'))) {
        socket.destroy()
        finish(undefined, Buffer.concat(chunks).toString())
      }
    })
    socket.on('error', (error) => finish(error))
    timer = setTimeout(() => {
      socket.destroy()
      finish(new Error('WebSocket tunnel timeout'))
    }, 1000)
    setTimeout(() => socket.write('echo'), 100)
  })

  assert.match(response, /101 Switching Protocols/)
  assert.match(response, /echo/)
})
