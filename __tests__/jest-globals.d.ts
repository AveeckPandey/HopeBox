// Ambient declarations for the Jest test surface used by the
// unit tests in this folder. We don't depend on @types/jest
// (the project's package.json pins sentry-expo@~57.0.0 which
// isn't on the registry, so we can't install it cleanly), so
// this file provides the minimum surface we actually use:
// describe / it / beforeEach / afterEach / expect / jest.Mock
// / jest.SpyInstance / jest.fn / jest.spyOn / jest.resetModules
// / jest.mock. Tests reference it via a triple-slash directive.
//
// This is intentionally narrower than @types/jest — we only
// declare what the existing tests need. If new tests use a
// jest feature not listed here, add the signature to this file
// before the test will typecheck.

declare function describe(
  name: string,
  fn: () => void | Promise<void>
): void;

declare function it(
  name: string,
  fn: () => void | Promise<void>
): void;
declare function it(
  name: string,
  fn: (done: (err?: unknown) => void) => void,
  timeout?: number
): void;

declare function beforeEach(
  fn: () => void | Promise<void>,
  timeout?: number
): void;
declare function afterEach(
  fn: () => void | Promise<void>,
  timeout?: number
): void;

declare const expect: {
  <T>(actual: T): {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeNull(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toContain(item: unknown): void;
    toHaveLength(len: number): void;
    toHaveBeenCalled(): void;
    toHaveBeenCalledTimes(n: number): void;
    toHaveBeenCalledWith(...args: unknown[]): void;
    toThrow(message?: string | RegExp): void;
    not: {
      toBe(expected: unknown): void;
      toEqual(expected: unknown): void;
      toBeNull(): void;
      toHaveBeenCalled(): void;
      toThrow(message?: string | RegExp): void;
    };
  };
};

declare namespace jest {
  interface Mock<T = unknown> {
    (): T;
    (...args: unknown[]): T;
    mock: {
      calls: unknown[][];
      results: Array<{ type: 'return' | 'throw'; value: unknown }>;
    };
    mockReturnValue(value: T): jest.Mock<T>;
    mockResolvedValue(value: T): jest.Mock<T>;
    mockImplementation(fn: (...args: unknown[]) => T): jest.Mock<T>;
  }
  interface SpyInstance<T = unknown> {
    mockRestore(): void;
    mockClear(): void;
    mockReset(): void;
    mockImplementation(fn: (...args: unknown[]) => T): jest.SpyInstance<T>;
  }
  function fn<T = unknown>(): jest.Mock<T>;
  function fn<T = unknown>(impl: (...args: unknown[]) => T): jest.Mock<T>;
  function spyOn<T extends object, M extends keyof T>(
    obj: T,
    method: M
  ): jest.SpyInstance;
  function resetModules(): void;
  function mock<T = unknown>(
    moduleName: string,
    factory: () => T,
    options?: { virtual?: boolean }
  ): void;
}
