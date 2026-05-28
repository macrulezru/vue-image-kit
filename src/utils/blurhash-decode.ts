const BASE83_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'

export function decode83(str: string, start: number, end: number): number {
  let value = 0
  for (let i = start; i < end; i++) {
    const index = BASE83_CHARS.indexOf(str[i])
    if (index === -1) throw new Error(`Invalid blurhash character: ${str[i]}`)
    value = value * 83 + index
  }
  return value
}

export function sRGBToLinear(value: number): number {
  const v = value / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

export function linearTosRGB(value: number): number {
  const v = Math.max(0, Math.min(1, value))
  return v <= 0.0031308
    ? Math.round(v * 12.92 * 255)
    : Math.round((1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255)
}

export function signPow(val: number, exp: number): number {
  return Math.sign(val) * Math.pow(Math.abs(val), exp)
}

function decodeDC(value: number): [number, number, number] {
  const r = value >> 16
  const g = (value >> 8) & 255
  const b = value & 255
  return [sRGBToLinear(r), sRGBToLinear(g), sRGBToLinear(b)]
}

function decodeAC(value: number, maximumValue: number): [number, number, number] {
  const quantR = Math.floor(value / (19 * 19))
  const quantG = Math.floor(value / 19) % 19
  const quantB = value % 19
  return [
    signPow((quantR - 9) / 9, 2) * maximumValue,
    signPow((quantG - 9) / 9, 2) * maximumValue,
    signPow((quantB - 9) / 9, 2) * maximumValue,
  ]
}

export function decodeBlurhash(
  blurhash: string,
  width: number,
  height: number,
): Uint8ClampedArray<ArrayBuffer> {
  if (blurhash.length < 6) {
    throw new Error('Invalid blurhash: too short')
  }

  const sizeFlag = decode83(blurhash, 0, 1)
  const numY = Math.floor(sizeFlag / 9) + 1
  const numX = (sizeFlag % 9) + 1
  const expectedLength = 4 + 2 * numX * numY
  if (blurhash.length !== expectedLength) {
    throw new Error(
      `Invalid blurhash: expected length ${expectedLength}, got ${blurhash.length}`,
    )
  }

  const quantisedMaximumValue = decode83(blurhash, 1, 2)
  const maximumValue = (quantisedMaximumValue + 1) / 166

  const colors: Array<[number, number, number]> = []
  const componentCount = numX * numY

  for (let i = 0; i < componentCount; i++) {
    if (i === 0) {
      const int = decode83(blurhash, 2, 6)
      colors.push(decodeDC(int))
    } else {
      const int = decode83(blurhash, 4 + i * 2, 6 + i * 2)
      colors.push(decodeAC(int, maximumValue))
    }
  }

  const pixels: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0
      let g = 0
      let b = 0

      for (let j = 0; j < numY; j++) {
        for (let i = 0; i < numX; i++) {
          const basis =
            Math.cos((Math.PI * x * i) / width) *
            Math.cos((Math.PI * y * j) / height)
          const color = colors[j * numX + i]
          r += color[0] * basis
          g += color[1] * basis
          b += color[2] * basis
        }
      }

      const offset = (y * width + x) * 4
      pixels[offset] = linearTosRGB(r)
      pixels[offset + 1] = linearTosRGB(g)
      pixels[offset + 2] = linearTosRGB(b)
      pixels[offset + 3] = 255
    }
  }

  return pixels
}
