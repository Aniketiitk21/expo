import chalk from 'chalk';

export function log(...message: string[]): void {
  console.log(...message);
}

export function error(...message: string[]): void {
  console.error(...message.map((value) => chalk.red(value)));
}

export function exit(message: string | Error, code: number = 1): never {
  if (message) {
    const text = message instanceof Error ? message.message : message;
    if (code === 0) {
      log(text);
    } else {
      error(text);
    }
  }
  process.exit(code);
}
