import type { Page, Route } from '@playwright/test';

/*
 * A Shelly discovery for the device wizard tests: the Shelly and Virtual plugins are enabled, one discovery session
 * finds three devices, and adoption fails for the kitchen relay the first time it is tried.
 */

const API = '/api/v1/';

const SESSION_ID = '00000000-0000-4000-8000-0000000000a1';

const device = (hostname: string, name: string, model: string, category: string) => ({
	identifier: hostname.replace('.local', ''),
	hostname,
	name,
	model,
	display_name: name,
	firmware: '1.4.4',
	status: 'ready',
	source: 'mdns',
	categories: [category, 'switcher'],
	suggested_category: category,
	authentication: { enabled: false, domain: null },
	registered_device_id: null,
	registered_device_name: null,
	registered_device_category: null,
	error: null,
	last_seen_at: new Date().toISOString(),
});

const DEVICES = [
	device('shellyplus1-living.local', 'Living room light', 'SNSW-001X16EU', 'lighting'),
	device('shellyplus2pm-kitchen.local', 'Kitchen relay', 'SNSW-102P16EU', 'switcher'),
	device('shellyplusplugs-desk.local', 'Desk plug', 'SNPL-00112EU', 'outlet'),
];

const envelope = (data: unknown): string => JSON.stringify({ status: 'success', timestamp: new Date().toISOString(), data });

export interface IShellyDiscovery {
	/** Every adoption request body, in order */
	adoptions: { hostname: string; name: string; category: string }[][];
}

export const serveShellyDiscovery = async (page: Page): Promise<IShellyDiscovery> => {
	const state: IShellyDiscovery = { adoptions: [] };

	const session = () => ({
		id: SESSION_ID,
		status: 'finished',
		started_at: new Date().toISOString(),
		expires_at: new Date(Date.now() + 600_000).toISOString(),
		remaining_seconds: 0,
		devices: DEVICES,
	});

	await page.route(
		(url: URL): boolean =>
			url.pathname.startsWith(API) &&
			(url.pathname.endsWith('modules/config/config/plugins') || url.pathname.includes('plugins/devices-shelly-ng/devices/')),
		async (route: Route): Promise<void> => {
			const request = route.request();
			const path = new URL(request.url()).pathname.slice(API.length);
			const reply = (data: unknown): Promise<void> => route.fulfill({ status: 200, contentType: 'application/json', body: envelope(data) });

			if (path === 'modules/config/config/plugins') {
				return reply([
					{
						type: 'devices-shelly-ng-plugin',
						enabled: true,
						mdns: { enabled: true, interface: null },
						websockets: { request_timeout: 10, ping_interval: 60, reconnect_interval: [5, 10] },
					},
					{ type: 'devices-virtual', enabled: true },
				]);
			}

			if (path === 'plugins/devices-shelly-ng/devices/discovery' || path === `plugins/devices-shelly-ng/devices/discovery/${SESSION_ID}`) {
				return reply(session());
			}

			if (path === 'plugins/devices-shelly-ng/devices/adopt') {
				const body = request.postDataJSON() as { data: { devices: { hostname: string; name: string; category: string }[] } };
				const attempt = state.adoptions.length;

				state.adoptions.push(body.data.devices);

				return reply(
					body.data.devices.map((item) => ({
						hostname: item.hostname,
						name: item.name,
						// The kitchen relay does not answer the first time
						status: attempt === 0 && item.hostname.includes('kitchen') ? 'failed' : 'created',
						error: attempt === 0 && item.hostname.includes('kitchen') ? 'The device did not answer in time.' : null,
					}))
				);
			}

			return route.fallback();
		}
	);

	return state;
};
