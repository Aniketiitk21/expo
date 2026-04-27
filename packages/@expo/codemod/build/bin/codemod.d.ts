#!/usr/bin/env node
export type Command = (argv?: string[]) => Promise<void>;
