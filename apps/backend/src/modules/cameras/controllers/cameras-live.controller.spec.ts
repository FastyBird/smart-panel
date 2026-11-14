import { FastifyReply } from 'fastify';

import { CamerasLiveController } from './cameras-live.controller';

describe('CamerasLiveController', () => {
	it('answers 426 with a fixed body and no request data', () => {
		const reply = { code: jest.fn(), header: jest.fn(), type: jest.fn(), send: jest.fn() };

		reply.code.mockReturnValue(reply);
		reply.header.mockReturnValue(reply);
		reply.type.mockReturnValue(reply);

		new CamerasLiveController().upgradeRequired(reply as unknown as FastifyReply);

		expect(reply.code).toHaveBeenCalledWith(426);
		expect(reply.header).toHaveBeenCalledWith('Upgrade', 'websocket');
		expect(reply.send).toHaveBeenCalledWith({ error: 'upgrade_required' });
	});
});
