import { describe, it } from 'node:test';
import { expect } from 'chai';
import { release } from '../src/release.js';

describe('release', () => {
  it('should work', () => {
    expect(release()).to.equal('release');
  });
});
