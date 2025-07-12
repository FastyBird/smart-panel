import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSockets } from './useSockets';

const mockEmitWithAck = vi.fn();

const mockTimeout = vi.fn(() => ({
	emitWithAck: mockEmitWithAck,
}));

const socketInstanceMock = {
	connected: false,
	active: false,
	timeout: mockTimeout,
};

vi.mock('../services/sockets', () => ({
	injectSockets: vi.fn(() => socketInstanceMock),
}));

describe('useSockets', () => {
	beforeEach(() => {
		socketInstanceMock.connected = true;
		socketInstanceMock.active = true;

		mockEmitWithAck.mockReset();
	});

	it('returns connected and active state', () => {
		const { connected, active } = useSockets();

		expect(connected.value).toBe(true);
		expect(active.value).toBe(true);
	});

	it('returns true on successful command', async () => {
		mockEmitWithAck.mockResolvedValue({
			status: 'ok',
			message: 'Success',
			results: [{ handler: 'test-handler', success: true }],
		});

		const { sendCommand } = useSockets();

		const result = await sendCommand('EVENT', {}, 'test-handler');
		expect(result).toBe(true);
	});

	it('returns error message on response error', async () => {
		mockEmitWithAck.mockResolvedValue({
			status: 'err',
			message: 'Something went wrong',
			results: [],
		});

		const { sendCommand } = useSockets();

		const result = await sendCommand('EVENT', {}, 'test-handler');
		expect(result).toBe('Something went wrong');
	});

	it('returns handler reason on failed command result', async () => {
		mockEmitWithAck.mockResolvedValue({
			status: 'ok',
			message: 'OK',
			results: [{ handler: 'test-handler', success: false, reason: 'Invalid input' }],
		});

		const { sendCommand } = useSockets();

		const result = await sendCommand('EVENT', {}, 'test-handler');
		expect(result).toBe('Invalid input');
	});

	it('returns fallback error when no response is received', async () => {
		mockEmitWithAck.mockResolvedValue(undefined);

		const { sendCommand } = useSockets();

		const result = await sendCommand('EVENT', {}, 'test-handler');
		expect(result).toBe('err');
	});
});
