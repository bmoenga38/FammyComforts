import { describe, it, expect } from 'vitest';
import { validateEnv } from './env';

describe('validateEnv', () => {
  it('applies defaults for an empty environment', () => {
    expect(validateEnv({})).toEqual({ NODE_ENV: 'development', PORT: 3001 });
  });

  it('coerces PORT and keeps DATABASE_URL', () => {
    expect(
      validateEnv({ PORT: '4000', DATABASE_URL: 'postgresql://x' }),
    ).toEqual({
      NODE_ENV: 'development',
      PORT: 4000,
      DATABASE_URL: 'postgresql://x',
    });
  });

  it('throws on a non-numeric PORT', () => {
    expect(() => validateEnv({ PORT: 'abc' })).toThrow(/Invalid environment/);
  });

  it('throws on an unknown NODE_ENV', () => {
    expect(() => validateEnv({ NODE_ENV: 'staging' })).toThrow(
      /Invalid environment/,
    );
  });
});
