// P42: logger forwards `logError` to Sentry when the package is
// installed and the SDK exposes `captureException`. The four
// guarantees we want to lock down:
//
//   1. logError actually calls Sentry.captureException.
//   2. Sensitive keys (`password`, `token`, …) are redacted in the
//      `extra` blob we hand to Sentry.
//   3. logWarning does NOT call Sentry (only logError does).
//   4. logError never throws, even if Sentry itself throws —
//      e.g. a half-installed native module that explodes on
//      `require`.
//
// `jest.mock` is hoisted above the imports, so the logger's
// dynamic `require('@sentry/react-native')` resolves to the mock
// factory. The `mock*`-prefixed variable is the one allowed to
// be referenced from inside the factory (jest hoist guard). The
// mock lets the test pass on a fresh clone where the package
// isn't yet installed in node_modules.

let mockCaptureException;

jest.mock(
  '@sentry/react-native',
  () => ({
    get captureException() {
      return mockCaptureException;
    },
  }),
  { virtual: true }
);

describe('logger', () => {
  let consoleWarn;
  let consoleLog;

  beforeEach(() => {
    jest.resetModules();
    mockCaptureException = jest.fn();
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarn.mockRestore();
    consoleLog.mockRestore();
  });

  it('logError forwards Error instances to Sentry.captureException', () => {
    const { logger } = require('../src/services/logger');
    const err = new Error('boom');
    logger.logError('test/context', err, { foo: 'bar' });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [captured, opts] = mockCaptureException.mock.calls[0];
    expect(captured).toBe(err);
    expect(opts.tags.context).toBe('test/context');
    expect(opts.extra).toEqual({ foo: 'bar' });
  });

  it('logError redacts the password field before forwarding to Sentry', () => {
    const { logger } = require('../src/services/logger');
    logger.logError('auth', new Error('nope'), {
      email: 'a@b.c',
      password: 'super-secret',
      token: 'shhh',
    });
    const [, opts] = mockCaptureException.mock.calls[0];
    expect(opts.extra.email).toBe('a@b.c');
    expect(opts.extra.password).toBe('[redacted]');
    expect(opts.extra.token).toBe('[redacted]');
  });

  it('logWarning does not call Sentry.captureException', () => {
    const { logger } = require('../src/services/logger');
    logger.logWarning('test/warn', 'something happened', { x: 1 });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('logError never throws even if Sentry.captureException throws', () => {
    mockCaptureException.mockImplementation(() => {
      throw new Error('sentry broken');
    });
    const { logger } = require('../src/services/logger');
    expect(() =>
      logger.logError('test', new Error('x'), { a: 1 })
    ).not.toThrow();
  });
});
