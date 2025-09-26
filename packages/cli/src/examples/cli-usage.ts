#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
  .name('shell-cli-example')
  .description('Example CLI tool for the shell architecture')
  .version('1.0.0');

program
  .command('create-module')
  .description('Create a new business module')
  .argument('<name>', 'module name')
  .action((name) => {
    console.log(`Creating module: ${name}`);
  });

program
  .command('list-modules')
  .description('List all business modules')
  .action(() => {
    console.log('Listing modules...');
  });

program.parse();