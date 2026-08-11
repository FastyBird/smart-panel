import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { ConfigService as NestConfigService } from '@nestjs/config';

import { MCP_OAUTH_PROVIDER_MATERIAL_FILENAME } from '../mcp.constants';

import { McpOAuthProviderMaterialService } from './mcp-oauth-provider-material.service';

describe('McpOAuthProviderMaterialService', () => {
	let configPath: string;

	beforeEach(() => {
		configPath = mkdtempSync(path.join(tmpdir(), 'mcp-oauth-provider-'));
	});

	afterEach(() => {
		rmSync(configPath, { force: true, recursive: true });
	});

	const createService = (): McpOAuthProviderMaterialService =>
		new McpOAuthProviderMaterialService({
			get: jest.fn((key: string) => (key === 'FB_CONFIG_PATH' ? configPath : undefined)),
		} as unknown as NestConfigService);

	it('creates private restart-stable cookie and signing material in the backed-up config directory', () => {
		const first = createService().get();
		const materialPath = path.join(configPath, MCP_OAUTH_PROVIDER_MATERIAL_FILENAME);
		const stored = JSON.parse(readFileSync(materialPath, 'utf8')) as Record<string, unknown>;
		const second = createService().get();

		expect(statSync(materialPath).mode & 0o777).toBe(0o600);
		expect(stored).toMatchObject({ version: 1 });
		expect(first.cookieKeys).toHaveLength(2);
		expect(new Set(first.cookieKeys).size).toBe(2);
		expect(first.jwks.keys).toHaveLength(1);
		expect(first.jwks.keys[0]).toMatchObject({ kty: 'RSA', use: 'sig', alg: 'RS256' });
		expect(first.jwks.keys[0]).toHaveProperty('d');
		expect(second).toEqual(first);
	});

	it('returns defensive copies without rewriting the stored material', () => {
		const service = createService();
		const first = service.get();
		first.cookieKeys[0] = 'mutated';
		first.jwks.keys[0].kid = 'mutated';

		const second = service.get();

		expect(second.cookieKeys[0]).not.toBe('mutated');
		expect(second.jwks.keys[0].kid).not.toBe('mutated');
	});

	it('tightens an existing material file to owner-only permissions', () => {
		const material = createService().get();
		const materialPath = path.join(configPath, MCP_OAUTH_PROVIDER_MATERIAL_FILENAME);
		writeFileSync(materialPath, `${JSON.stringify({ version: 1, ...material })}\n`, { mode: 0o644 });
		chmodSync(materialPath, 0o644);

		createService().get();

		expect(statSync(materialPath).mode & 0o777).toBe(0o600);
	});

	it('fails closed instead of replacing malformed material', () => {
		const materialPath = path.join(configPath, MCP_OAUTH_PROVIDER_MATERIAL_FILENAME);
		writeFileSync(materialPath, '{"version":1,"cookieKeys":[]}\n', { mode: 0o600 });

		expect(() => createService().get()).toThrow('Persistent MCP OAuth provider material is unavailable or invalid');
		expect(readFileSync(materialPath, 'utf8')).toBe('{"version":1,"cookieKeys":[]}\n');
	});

	it('rejects a provider-material symlink', () => {
		const outsideDirectory = path.join(configPath, 'outside');
		const outsidePath = path.join(outsideDirectory, 'material.json');
		mkdirSync(outsideDirectory);
		writeFileSync(outsidePath, '{}', { mode: 0o600 });
		symlinkSync(outsidePath, path.join(configPath, MCP_OAUTH_PROVIDER_MATERIAL_FILENAME));

		expect(() => createService().get()).toThrow('Persistent MCP OAuth provider material is unavailable or invalid');
	});
});
