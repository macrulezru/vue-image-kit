#!/usr/bin/env node

import { runGenerateCommand } from './commands/generate.js'
import { runScanCommand } from './commands/scan.js'
import { runPlaceholdersCommand } from './commands/placeholders.js'

const COMMANDS: Record<string, (argv: string[]) => Promise<number>> = {
  generate: runGenerateCommand,
  scan: runScanCommand,
  placeholders: runPlaceholdersCommand,
}

const HELP = `
vue-image-kit — image tooling for @macrulez/vue-image-kit

Usage:
  npx vue-image-kit <command> [options]

Commands:
  generate       Resize images and generate srcset variants, LQIP and hashes (default)
  scan           Report how vue-image-kit is used across the project
  placeholders   Generate blurhash/thumbhash/dominant-color placeholders for <VImage> usages

Run "npx vue-image-kit <command> --help" for the options of a command.
`

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const commandIndex = argv.findIndex((arg) => !arg.startsWith('-'))
  const command = commandIndex >= 0 ? argv[commandIndex]! : 'generate'
  const rest = commandIndex >= 0 ? [...argv.slice(0, commandIndex), ...argv.slice(commandIndex + 1)] : argv

  if (commandIndex < 0 && (argv.includes('--help') || argv.includes('-h'))) {
    console.log(HELP)
    return
  }

  const run = COMMANDS[command]
  if (!run) {
    console.error(`[vue-image-kit] Unknown command: "${command}". Available: ${Object.keys(COMMANDS).join(', ')}`)
    process.exit(1)
  }

  try {
    const code = await run(rest)
    if (code !== 0) process.exit(code)
  } catch (err) {
    console.error(`[vue-image-kit] ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}

main()
