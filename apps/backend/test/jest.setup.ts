/**
 * Jest setup file for e2e tests.
 *
 * - Enables DB synchronize so in-memory SQLite creates tables from entities
 * - Silences NestJS Logger to keep test output clean
 */
process.env.FB_DB_SYNC = 'true';

import { Logger } from '@nestjs/common';

// Silence the NestJS Logger during tests
// Tests that intentionally trigger errors (e.g., testing error handling)
// would otherwise produce noisy console output
// Using beforeEach instead of beforeAll to survive jest.resetAllMocks() calls
beforeEach(() => {
	jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'fatal').mockImplementation(() => undefined);
});
