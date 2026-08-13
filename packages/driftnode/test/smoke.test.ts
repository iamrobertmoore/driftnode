import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME, version } from '../src/index';

describe('toolchain smoke', () => {
  it('builds and imports', () => {
    expect(PACKAGE_NAME).toBe('driftnode');
    expect(version()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
