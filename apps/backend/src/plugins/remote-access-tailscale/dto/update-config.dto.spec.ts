import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME } from '../remote-access-tailscale.constants';

import { UpdateRemoteAccessTailscalePluginConfigDto } from './update-config.dto';

/**
 * `serve_https` and `funnel` are accepted fields (forward compatibility for
 * RA-6) but the managed service never applies them yet — submitting a
 * non-default value would silently create an unapplied, user-visible state.
 * Until RA-6 lifts this, only the current default is accepted.
 */
describe('UpdateRemoteAccessTailscalePluginConfigDto', () => {
	it('accepts a partial update that omits serve_https and funnel entirely', async () => {
		const dto = plainToInstance(UpdateRemoteAccessTailscalePluginConfigDto, {
			type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			hostname: 'smart-panel',
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it('accepts serve_https: true (the only currently applied value)', async () => {
		const dto = plainToInstance(UpdateRemoteAccessTailscalePluginConfigDto, {
			type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			serve_https: true,
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it('rejects serve_https: false until RA-6 applies it', async () => {
		const dto = plainToInstance(UpdateRemoteAccessTailscalePluginConfigDto, {
			type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			serve_https: false,
		});

		const errors = await validate(dto);

		expect(errors).not.toHaveLength(0);
		expect(errors.some((error) => error.property === 'serve_https')).toBe(true);
	});

	it('accepts funnel: false (the only currently applied value)', async () => {
		const dto = plainToInstance(UpdateRemoteAccessTailscalePluginConfigDto, {
			type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			funnel: false,
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it('rejects funnel: true until RA-6 applies it', async () => {
		const dto = plainToInstance(UpdateRemoteAccessTailscalePluginConfigDto, {
			type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			funnel: true,
		});

		const errors = await validate(dto);

		expect(errors).not.toHaveLength(0);
		expect(errors.some((error) => error.property === 'funnel')).toBe(true);
	});
});
