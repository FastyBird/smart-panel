import { ConfigService } from '../../config/services/config.service';

import { getConfigTimezone } from './timezone.utils';

describe('house scheduling timezone', () => {
	it('propagates the original configuration read failure', () => {
		const cause = new Error('Configuration unavailable');
		const config = {
			getModuleConfig: () => {
				throw cause;
			},
		} as unknown as ConfigService;
		expect(() => getConfigTimezone(config)).toThrow(cause);
	});
	it.each([null, undefined, 'Europe/Prague'])('uses the server default only for a nullish zone: %s', (timezone) => {
		const config = { getModuleConfig: () => ({ timezone }) } as unknown as ConfigService;
		expect(getConfigTimezone(config)).toBe(timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
	});
});
