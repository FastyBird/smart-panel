import { describe, expect, it } from 'vitest';

import { configPluginFamily } from './config-families';

describe('configPluginFamily', () => {
	it.each([
		['devices-shelly-ng-plugin', 'devices'],
		['devices-homekit', 'devices'],
		['simulator-plugin', 'devices'],
		['buddy-claude-plugin', 'buddy'],
		['notifications-slack-plugin', 'notifications'],
		['influx-v2-plugin', 'storage'],
		['logger-rotating-file-plugin', 'storage'],
		['memory-storage-plugin', 'storage'],
		['remote-access-tailscale-plugin', 'remoteAccess'],
		['weather-open-meteo-plugin', 'weather'],
		['pages-tiles-plugin', 'other'],
	])('puts %s among %s', (type, family) => {
		expect(configPluginFamily(type).id).toBe(family);
	});

	it('matches a whole type only as a whole', () => {
		expect(configPluginFamily('simulator-plugin-extra').id).toBe('other');
	});
});
