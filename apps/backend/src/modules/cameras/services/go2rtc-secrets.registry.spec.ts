import { Go2rtcSecretsRegistry } from './go2rtc-secrets.registry';

describe('Go2rtcSecretsRegistry', () => {
	let registry: Go2rtcSecretsRegistry;

	beforeEach(() => {
		registry = new Go2rtcSecretsRegistry();
	});

	it('lists added secrets and drops them when the handle is released', () => {
		const release = registry.add('PW_SENTINEL_abcdef0123');

		expect(registry.list()).toEqual(['PW_SENTINEL_abcdef0123']);

		release();

		expect(registry.list()).toEqual([]);
	});

	it('ignores strings shorter than 8 characters', () => {
		const release = registry.add('short');

		expect(registry.list()).toEqual([]);
		expect(() => release()).not.toThrow();
	});

	it('keeps a literal while another handle still holds it', () => {
		const first = registry.add('rtsps://console:7441/SENTINELALIAS0123456789');
		const second = registry.add('rtsps://console:7441/SENTINELALIAS0123456789');

		expect(registry.list()).toEqual(['rtsps://console:7441/SENTINELALIAS0123456789']);

		first();

		expect(registry.list()).toEqual(['rtsps://console:7441/SENTINELALIAS0123456789']);

		second();

		expect(registry.list()).toEqual([]);
	});

	it('releases a handle only once', () => {
		const first = registry.add('SHARED_LITERAL_1');
		const second = registry.add('SHARED_LITERAL_1');

		first();
		first();

		expect(registry.list()).toEqual(['SHARED_LITERAL_1']);

		second();

		expect(registry.list()).toEqual([]);
	});
});
