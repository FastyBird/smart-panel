import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME } from '../remote-access-cloudflare-tunnel.constants';

import { UpdateRemoteAccessCloudflareTunnelPluginConfigDto } from './update-config.dto';

describe('UpdateRemoteAccessCloudflareTunnelPluginConfigDto', () => {
	it('accepts a partial update that omits every optional field', async () => {
		const dto = plainToInstance(UpdateRemoteAccessCloudflareTunnelPluginConfigDto, {
			type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it('accepts a valid public_hostname', async () => {
		const dto = plainToInstance(UpdateRemoteAccessCloudflareTunnelPluginConfigDto, {
			type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
			public_hostname: 'panel.example.com',
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it('accepts an explicit null public_hostname (clears it)', async () => {
		const dto = plainToInstance(UpdateRemoteAccessCloudflareTunnelPluginConfigDto, {
			type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
			public_hostname: null,
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it('rejects a public_hostname with a scheme', async () => {
		const dto = plainToInstance(UpdateRemoteAccessCloudflareTunnelPluginConfigDto, {
			type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
			public_hostname: 'https://panel.example.com',
		});

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'publicHostname')).toBe(true);
	});

	it('rejects a public_hostname with a path', async () => {
		const dto = plainToInstance(UpdateRemoteAccessCloudflareTunnelPluginConfigDto, {
			type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
			public_hostname: 'panel.example.com/dashboard',
		});

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'publicHostname')).toBe(true);
	});

	it('rejects a bare hostname with no TLD', async () => {
		const dto = plainToInstance(UpdateRemoteAccessCloudflareTunnelPluginConfigDto, {
			type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
			public_hostname: 'panel',
		});

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'publicHostname')).toBe(true);
	});

	it.each(['auto', 'http2', 'quic'])('accepts protocol: %s', async (protocol) => {
		const dto = plainToInstance(UpdateRemoteAccessCloudflareTunnelPluginConfigDto, {
			type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
			protocol,
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it('rejects an unknown protocol', async () => {
		const dto = plainToInstance(UpdateRemoteAccessCloudflareTunnelPluginConfigDto, {
			type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
			protocol: 'websocket',
		});

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'protocol')).toBe(true);
	});

	it('accepts a tunnel_token submitted as null (clears it)', async () => {
		const dto = plainToInstance(UpdateRemoteAccessCloudflareTunnelPluginConfigDto, {
			type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
			tunnel_token: null,
		});

		expect(dto.tunnelToken).toBeNull();
		expect(await validate(dto)).toHaveLength(0);
	});

	it('reads tunnel_token as undefined when the field is not submitted at all, distinct from an explicit null', () => {
		const dto = plainToInstance(UpdateRemoteAccessCloudflareTunnelPluginConfigDto, {
			type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
		});

		expect(dto.tunnelToken).toBeUndefined();
	});

	it('accepts a replacement tunnel_token', async () => {
		const dto = plainToInstance(UpdateRemoteAccessCloudflareTunnelPluginConfigDto, {
			type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
			tunnel_token: 'a-real-token',
		});

		expect(dto.tunnelToken).toBe('a-real-token');
		expect(await validate(dto)).toHaveLength(0);
	});
});
