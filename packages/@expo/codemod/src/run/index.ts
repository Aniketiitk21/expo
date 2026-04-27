import chalk from 'chalk';
import globby from 'globby';
import multimatch from 'multimatch';

import type { Command } from '../../bin/codemod';
import * as Log from '../log';
import { listTransformsAsync } from '../transforms';
import { assertWithOptionsArgs, printHelp } from '../utils/args';
import { runTransformAsync } from '../utils/runner';

const OPTIONS_BLOCK = [
  '<transform>                   (required) name of transform to apply to files',
  '                              (see a list of transforms available below)',
  '<paths...>                    one or more paths or globs (e.g. src/**/*.tsx)',
  '                              files in .gitignore are ignored by default',
  '-h, --help                    print this help message',
  '-v, --version                 print the CLI version',
].join('\n');

const transformsBlock = (transforms: string[]): string =>
  ['', `  ${chalk.bold('Transforms available')}`, ...transforms.map((t) => `    ${t}`), ''].join(
    '\n'
  );

export type ParsedCommand = {
  transform: string;
  paths: string[];
};

/**
 * Parse argv, validate it against the available transforms, and return the
 * resolved command. Prints help and exits when --help is passed or required
 * arguments are missing.
 */
export async function parseAndValidateArgs(argv: string[] | undefined): Promise<ParsedCommand> {
  const args = assertWithOptionsArgs(
    {
      '--help': Boolean,
      '-h': '--help',
    },
    { argv, permissive: true }
  );

  const transforms = await listTransformsAsync();
  const [transform, ...paths] = args._;

  if (args['--help'] || !transform || paths.length === 0) {
    printHelp(
      'Run a codemod transform against the given paths.',
      'npx @expo/codemod <transform> <paths...>',
      OPTIONS_BLOCK,
      transformsBlock(transforms)
    );
  }

  if (!transforms.includes(transform)) {
    Log.exit(`Transform "${transform}" does not exist. Valid options: ${transforms.join(', ')}`);
  }

  return { transform, paths };
}

/**
 * Expand the given paths into a file list (respecting .gitignore) and dispatch
 * them to the jscodeshift runner. Files are split by extension into the `tsx`
 * and `jsx` parser buckets.
 */
export async function resolveAndDispatch(command: ParsedCommand): Promise<void> {
  const { transform, paths } = command;
  const allFiles = await globby(paths, {
    gitignore: true,
    ignore: ['**/node_modules/**'],
  });

  const tsxFiles = multimatch(allFiles, ['**/*.ts', '**/*.tsx']);
  const jsxFiles = multimatch(allFiles, ['**/*.js', '**/*.jsx']);

  if (tsxFiles.length) {
    Log.log(`Transforming ${tsxFiles.length} TSX files...`);
    await runTransformAsync({ files: tsxFiles, parser: 'tsx', transform });
  }

  if (jsxFiles.length) {
    Log.log(`Transforming ${jsxFiles.length} JSX files...`);
    await runTransformAsync({ files: jsxFiles, parser: 'jsx', transform });
  }
}

export const runCommand: Command = async (argv) => {
  const command = await parseAndValidateArgs(argv);
  await resolveAndDispatch(command);
};
