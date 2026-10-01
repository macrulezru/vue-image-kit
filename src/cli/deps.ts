import type sharpFactory from 'sharp'

export type SharpFactory = typeof sharpFactory
export type RgbaToThumbHash = (w: number, h: number, rgba: Uint8Array) => Uint8Array

export function installHint(pkg: string, purpose: string): string {
  return (
    `\n[vue-image-kit] ${pkg} is not installed — ${purpose}.\n\n` +
    '  Install it as a dev dependency:\n\n' +
    `    npm install -D ${pkg}\n` +
    `    pnpm add -D ${pkg}\n` +
    `    yarn add -D ${pkg}\n`
  )
}

export async function loadSharp(command: string): Promise<SharpFactory> {
  try {
    return (await import('sharp')).default
  } catch {
    console.error(installHint('sharp', `the "${command}" command needs it to read images`))
    process.exit(1)
  }
}

export async function loadThumbhash(command: string): Promise<RgbaToThumbHash> {
  try {
    return (await import('thumbhash')).rgbaToThumbHash
  } catch {
    console.error(
      installHint('thumbhash', `the "${command}" command needs it to encode ThumbHash strings`),
    )
    process.exit(1)
  }
}
