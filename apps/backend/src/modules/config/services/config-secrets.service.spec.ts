import { ConfigSecretField } from '../interfaces/config-secret.interface';

import { ConfigSecretsService } from './config-secrets.service';

describe('ConfigSecretsService', () => {
	let service: ConfigSecretsService;

	const fields: readonly ConfigSecretField[] = [
		{
			path: 'api_key',
			configuredPath: 'api_key_configured',
		},
		{
			path: 'mqtt.password',
			configuredPath: 'mqtt.password_configured',
		},
	];

	beforeEach(() => {
		service = new ConfigSecretsService();
	});

	it('projects secret fields as configured indicators without mutating the source', () => {
		const source = {
			type: 'mock',
			api_key: 'top-secret',
			mqtt: { host: 'broker.local', password: 'nested-secret' },
		};

		expect(service.toPublic(source, fields)).toEqual({
			type: 'mock',
			api_key_configured: true,
			mqtt: { host: 'broker.local', password_configured: true },
		});
		expect(source.api_key).toBe('top-secret');
		expect(source.mqtt.password).toBe('nested-secret');
	});

	it('reports null and blank secrets as not configured', () => {
		expect(service.toPublic({ api_key: null, mqtt: { password: '   ' } }, fields)).toEqual({
			api_key_configured: false,
			mqtt: { password_configured: false },
		});
	});

	it('preserves an omitted secret while retaining other submitted fields', () => {
		const resolved = service.resolveUpdate(
			{ api_key: 'stored-secret', hostname: 'old.local' },
			{ hostname: 'new.local' },
			{ hostname: 'new.local' },
			fields.slice(0, 1),
		);

		expect(resolved).toEqual({ hostname: 'new.local', api_key: 'stored-secret' });
	});

	it('does not treat a blank replacement field as an explicit clear', () => {
		const resolved = service.resolveUpdate(
			{ api_key: 'stored-secret' },
			{ api_key: '   ' },
			{ api_key: '   ' },
			fields.slice(0, 1),
		);

		expect(resolved).toEqual({ api_key: 'stored-secret' });
	});

	it('replaces a submitted secret', () => {
		const resolved = service.resolveUpdate(
			{ api_key: 'stored-secret' },
			{ api_key: 'replacement' },
			{ api_key: 'replacement' },
			fields.slice(0, 1),
		);

		expect(resolved).toEqual({ api_key: 'replacement' });
	});

	it('accepts registered input aliases from internal callers', () => {
		const resolved = service.resolveUpdate(
			{ api_key: 'stored-secret' },
			{ api_key: 'replacement' },
			{ apiKey: 'replacement' },
			[{ ...fields[0], inputPaths: ['apiKey'] }],
		);

		expect(resolved).toEqual({ api_key: 'replacement' });
	});

	const camelCaseUpdates: ReadonlyArray<readonly [string | null, string | null]> = [
		['replacement', 'replacement'],
		[null, null],
	];

	it.each(camelCaseUpdates)(
		'recognizes camel-case programmatic secret updates through serialized paths',
		(submitted, expected) => {
			const resolved = service.resolveUpdate(
				{ api_key: 'stored-secret' },
				{ api_key: submitted },
				{ apiKey: submitted },
				fields.slice(0, 1),
			);

			expect(resolved).toEqual({ api_key: expected });
		},
	);

	it('clears a secret only when null is explicitly submitted', () => {
		const resolved = service.resolveUpdate(
			{ api_key: 'stored-secret' },
			{ api_key: null },
			{ api_key: null },
			fields.slice(0, 1),
		);

		expect(resolved).toEqual({ api_key: null });
	});

	it('deep-merges a preserved nested secret without discarding sibling settings', () => {
		const existing = {
			mqtt: {
				host: 'broker.local',
				port: 1883,
				username: 'panel',
				password: 'stored-secret',
			},
		};
		const update = service.resolveUpdate(existing, { mqtt: { host: 'new.local' } }, { mqtt: { host: 'new.local' } }, [
			fields[1],
		]);

		expect(service.merge(existing, update)).toEqual({
			mqtt: {
				host: 'new.local',
				port: 1883,
				username: 'panel',
				password: 'stored-secret',
			},
		});
	});

	it('redacts secret fields and occurrences from logging payloads', () => {
		const secretSource = { api_key: 'sentinel-secret' };
		const value = {
			api_key: 'sentinel-secret',
			message: 'Connection failed for sentinel-secret',
			nested: ['sentinel-secret'],
		};

		expect(service.redactForLogging(value, fields.slice(0, 1), secretSource)).toEqual({
			api_key: '[REDACTED]',
			message: 'Connection failed for [REDACTED]',
			nested: ['[REDACTED]'],
		});
	});
});
