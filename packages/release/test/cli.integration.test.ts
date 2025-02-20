import test from 'node:test';
import { expect } from 'chai';
import { execa } from 'execa';

const cliPath = 'dist/cli.js';

const $ = execa({
  // Make sure we're not inheriting anything weird from the test runner node
  // process.
  env: { NODE_OPTIONS: '' },
});

test('should display help information when run with --help', async () => {
  const { stdout } = await $('node', [cliPath]);
  expect(stdout).to.include('Hello from My CLI Tool!!');
});
