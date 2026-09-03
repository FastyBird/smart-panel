import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME } from '../remote-access-tailscale.constants';

import { UpdateRemoteAccessTailscalePluginConfigDto } from './update-config.dto';

/**
 * `serve_https` and `funnel` are applied by the managed service's Serve/
 * Funnel apply step (RA-6) — both boolean values are accepted like any other
 * plugin preference.
 */
describe('UpdateRemoteAccessTailscalePluginConfigDto', () => {
	it('accepts a partial update that omits serve_https and funnel entirely', async () => {
		const dto = plainToInstance(UpdateRemoteAccessTailscalePluginConfigDto, {
			type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			hostname: 'smart-panel',
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it('accepts serve_https: true', async () => {
		const dto = plainToInstance(UpdateRemoteAccessTailscalePluginConfigDto, {
			type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			serve_https: true,
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it('accepts serve_https: false', async () => {
		const dto = plainToInstance(UpdateRemoteAccessTailscalePluginConfigDto, {
			type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			serve_https: false,
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it('rejects a non-boolean serve_https', async () => {
		const dto = plainToInstance(UpdateRemoteAccessTailscalePluginConfigDto, {
			type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			serve_https: 'yes',
		});

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'serve_https')).toBe(true);
	});

	it('accepts funnel: true', async () => {
		const dto = plainToInstance(UpdateRemoteAccessTailscalePluginConfigDto, {
			type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			funnel: true,
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it('accepts funnel: false', async () => {
		const dto = plainToInstance(UpdateRemoteAccessTailscalePluginConfigDto, {
			type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			funnel: false,
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it('rejects a non-boolean funnel', async () => {
		const dto = plainToInstance(UpdateRemoteAccessTailscalePluginConfigDto, {
			type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			funnel: 'no',
		});

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'funnel')).toBe(true);
	});

	it('accepts both serve_https and funnel set together', async () => {
		const dto = plainToInstance(UpdateRemoteAccessTailscalePluginConfigDto, {
			type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			serve_https: true,
			funnel: true,
		});

		expect(await validate(dto)).toHaveLength(0);
	});
});
