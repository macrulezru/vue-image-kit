export interface DownloadOptions {
  timeout: number
  maxBytes: number
}

export class DownloadError extends Error {}

function isImageResponse(contentType: string | null): boolean {
  if (!contentType) return true
  const type = contentType.toLowerCase()
  return (
    type.startsWith('image/') ||
    type.startsWith('application/octet-stream') ||
    type.startsWith('binary/')
  )
}

function tooLarge(maxBytes: number): DownloadError {
  return new DownloadError(
    `larger than the ${(maxBytes / 1024 / 1024).toFixed(1)} MB limit (--max-bytes)`,
  )
}

async function readBody(response: Response, limit: number, truncate: boolean): Promise<Buffer> {
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer())
    if (!truncate && buffer.byteLength > limit) throw tooLarge(limit)
    return truncate ? buffer.subarray(0, limit) : buffer
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      total += value.byteLength
      if (truncate && total >= limit) break
      if (!truncate && total > limit) throw tooLarge(limit)
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
  const buffer = Buffer.concat(chunks)
  return truncate ? buffer.subarray(0, limit) : buffer
}

async function fetchBuffer(
  url: string,
  timeout: number,
  limit: number,
  truncate: boolean,
  headers: Record<string, string> = {},
): Promise<Buffer> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, {
      headers: { accept: 'image/*', ...headers },
      signal: controller.signal,
      redirect: 'follow',
    })
    if (!response.ok) throw new DownloadError(`HTTP ${response.status}`)
    if (!isImageResponse(response.headers.get('content-type'))) {
      throw new DownloadError(
        `not an image (content-type: ${response.headers.get('content-type')})`,
      )
    }
    const length = Number(response.headers.get('content-length') ?? '0')
    if (!truncate && response.status !== 206 && length > limit) throw tooLarge(limit)
    return await readBody(response, limit, truncate)
  } catch (err) {
    if (err instanceof DownloadError) throw err
    if ((err as Error).name === 'AbortError')
      throw new DownloadError(`timed out after ${timeout} ms`)
    throw new DownloadError((err as Error).message)
  } finally {
    clearTimeout(timer)
  }
}

export function downloadImage(url: string, options: DownloadOptions): Promise<Buffer> {
  return fetchBuffer(url, options.timeout, options.maxBytes, false)
}

export function downloadHead(url: string, timeout: number, bytes = 65536): Promise<Buffer> {
  return fetchBuffer(url, timeout, bytes, true, { range: `bytes=0-${bytes - 1}` })
}
