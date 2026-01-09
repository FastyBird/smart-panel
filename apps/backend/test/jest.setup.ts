/**
 * Jest setup file to silence NestJS Logger during tests.
 *
 * This prevents expected error logs from cluttering the test output
 * while still allowing tests to pass when testing error scenarios.
 */
import { Logger } from '@nestjs/common';

// Silence the NestJS Logger during tests
// Tests that intentionally trigger errors (e.g., testing error handling)
// would otherwise produce noisy console output
beforeAll(() => {
	jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => undefined);
});
