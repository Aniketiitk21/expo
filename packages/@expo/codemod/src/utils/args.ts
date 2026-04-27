import arg from 'arg';
import chalk from 'chalk';

import * as Log from '../log';

const isArgParseError = (error: unknown): error is Error & { code: string } => {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  const code = (error as { code: unknown }).code;
  return typeof code === 'string' && code.startsWith('ARG_') && !code.startsWith('ARG_CONFIG_');
};

export function assertWithOptionsArgs(
  schema: arg.Spec,
  options: arg.Options
): arg.Result<arg.Spec> {
  try {
    return arg(schema, options);
  } catch (error: unknown) {
    if (isArgParseError(error)) {
      Log.exit(error.message, 1);
    }
    throw error;
  }
}

export function printHelp(info: string, usage: string, options: string, extra: string = ''): never {
  Log.exit(
    chalk`
  {bold Info}
    ${info}

  {bold Usage}
    {dim $} ${usage}

  {bold Options}
    ${options.split('\n').join('\n    ')}
` + extra,
    0
  );
}
