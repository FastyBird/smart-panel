import { existsSync } from 'fs';
import { join, resolve } from 'path';

import { ConfigService as NestConfigService } from '@nestjs/config';

import { resolveUserDefinitionsDirectory } from './user-definitions-directory';

const configWith = (value: string | undefined): NestConfigService =>
	({ get: jest.fn().mockReturnValue(value) }) as unknown as NestConfigService;

describe('resolveUserDefinitionsDirectory', () => {
	it('defaults to <repo>/var/data when FB_CONFIG_PATH is unset', () => {
		const result = resolveUserDefinitionsDirectory(configWith(undefined));

		expect(result.endsWith(join('var', 'data'))).toBe(true);
		expect(existsSync(join(result, '..', '..', 'pnpm-workspace.yaml'))).toBe(true);
	});

	it('uses FB_CONFIG_PATH when set', () => {
		expect(resolveUserDefinitionsDirectory(configWith('/tmp/x'))).toBe(resolve('/tmp/x'));
	});

	it('falls back to the default for a blank value', () => {
		expect(resolveUserDefinitionsDirectory(configWith('  '))).toBe(
			resolveUserDefinitionsDirectory(configWith(undefined)),
		);
	});
});
