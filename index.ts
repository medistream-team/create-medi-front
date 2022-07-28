#!/usr/bin/env node
// import * as fs from 'node:fs';
// import * as path from 'node:path';
import minimist from 'minimist';

async function init() {
  console.log('\n-- Init Vue 3 Medistream Frontend Project --\n');

  const cwd = process.cwd();
  const argv = minimist(process.argv.slice(2), { boolean: true });

  console.log(cwd, argv);
}

init().catch(console.error)