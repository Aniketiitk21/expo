#!/usr/bin/env node
import arg from 'arg';
import path from 'path';

import * as Log from '../src/log';

export type Command = (argv?: string[]) => Promise<void>;

async function main(): Promise<void> {
  const args = arg(
    {
      '--version': Boolean,
      '-v': '--version',
    },
    {
      permissive: true,
      argv: process.argv.slice(2),
    }
  );

  if (args['--version']) {
    // After build, this file is at build/bin/codemod.js, so the package root
    // is two levels up
    const pkg = require(path.resolve(__dirname, '..', '..', 'package.json'));
    Log.log(pkg.version);
    process.exit(0);
  }

  const { runCommand } = await import('../src/run/index.js');
  await runCommand(args._);
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  Log.error(message);
  process.exit(1);
});
