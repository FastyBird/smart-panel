import { FastifyReply, FastifyRequest } from 'fastify';

import { HttpAdapterHost } from '@nestjs/core';

import { CAMERAS_LIVE_PATH } from '../cameras.constants';

import { LiveUpgradeRequiredHook } from './live-upgrade-required.hook';

type Hook = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

const request = (url: string): FastifyRequest => ({ raw: { url } }) as unknown as FastifyRequest;

const createReply = () => {
	const reply = { code: jest.fn(), header: jest.fn(), type: jest.fn(), send: jest.fn() };

	reply.code.mockReturnValue(reply);
	reply.header.mockReturnValue(reply);
	reply.type.mockReturnValue(reply);
	reply.send.mockReturnValue(reply);

	return reply;
};

describe('LiveUpgradeRequiredHook', () => {
	const register = (): Hook => {
		const addHook = jest.fn();
		const adapterHost = { httpAdapter: { getInstance: () => ({ addHook }) } };

		new LiveUpgradeRequiredHook(adapterHost as unknown as HttpAdapterHost).onModuleInit();

		expect(addHook).toHaveBeenCalledTimes(1);
		expect(addHook).toHaveBeenCalledWith('onRequest', expect.any(Function));

		return (addHook.mock.calls as Array<[string, Hook]>)[0][1];
	};

	it('answers the live path, with or without a query, with the fixed 426 and ends the request', async () => {
		const hook = register();

		for (const url of [CAMERAS_LIVE_PATH, `${CAMERAS_LIVE_PATH}?session=secret-token-value`]) {
			const reply = createReply();

			await expect(hook(request(url), reply as unknown as FastifyReply)).resolves.toBe(reply);
			expect(reply.code).toHaveBeenCalledWith(426);
			expect(reply.header).toHaveBeenCalledWith('Upgrade', 'websocket');
			expect(reply.send).toHaveBeenCalledWith({ error: 'upgrade_required' });
		}
	});

	it('does nothing for any other path, and lets the request continue', async () => {
		const hook = register();

		for (const url of [
			'/',
			`${CAMERAS_LIVE_PATH}/`,
			`${CAMERAS_LIVE_PATH}x?session=a`,
			'/api/v1/modules/cameras/cameras',
			`/other?next=${CAMERAS_LIVE_PATH}`,
		]) {
			const reply = createReply();

			await expect(hook(request(url), reply as unknown as FastifyReply)).resolves.toBeUndefined();
			expect(reply.send).not.toHaveBeenCalled();
		}
	});

	it('does nothing without an HTTP adapter or a Fastify instance', () => {
		expect(() =>
			new LiveUpgradeRequiredHook({ httpAdapter: undefined } as unknown as HttpAdapterHost).onModuleInit(),
		).not.toThrow();
		expect(() =>
			new LiveUpgradeRequiredHook({
				httpAdapter: { getInstance: () => ({}) },
			} as unknown as HttpAdapterHost).onModuleInit(),
		).not.toThrow();
	});
});
