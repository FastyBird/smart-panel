import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { ShellyDevice } from '../interfaces/shellies.interface';

import { readShellyRelayStatus } from './shellies';

describe('Shelly Gen1 authenticated /status transport', () => {
	it('distinguishes a refused connection from an HTTP error or dropped response after sending', async () => {
		let mode: 'ok' | 'denied' | 'dropped' | 'redirected' = 'ok';
		const arrivals: (string | undefined)[] = [];
		const sequence: string[] = [];
		const server = createServer((request, response) => {
			arrivals.push(request.headers.authorization);
			sequence.push('received');
			if (mode === 'dropped') request.socket.destroy();
			else if (mode === 'redirected') {
				response.writeHead(302, { Location: '/other' });
				response.end();
			} else {
				response.writeHead(mode === 'denied' ? 401 : 200, { 'Content-Type': 'application/json' });
				response.end(JSON.stringify({ mac: 'AABBCCDDEEFF' }));
			}
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const { Switch } = jest.requireActual<{ Switch: new (id: string, host: string) => ShellyDevice }>(
			'shellies/lib/devices/base',
		);
		const peer = new Switch('DDEEFF', `127.0.0.1:${(server.address() as AddressInfo).port}`);
		peer.setAuthCredentials('admin', 'fixture');
		const dispatching = jest.fn(() => sequence.push('sent'));
		try {
			await expect(readShellyRelayStatus(peer, dispatching)).resolves.toEqual({
				sent: true,
				status: { mac: 'AABBCCDDEEFF' },
			});
			mode = 'denied';
			await expect(readShellyRelayStatus(peer, dispatching)).resolves.toEqual({ sent: true });
			mode = 'dropped';
			await expect(readShellyRelayStatus(peer, dispatching)).resolves.toEqual({ sent: true });
			mode = 'redirected';
			await expect(readShellyRelayStatus(peer, dispatching)).resolves.toEqual({ sent: true });
			expect(arrivals).toEqual(Array(4).fill('Basic ' + Buffer.from('admin:fixture').toString('base64')));
			expect(sequence).toEqual(['sent', 'received', 'sent', 'received', 'sent', 'received', 'sent', 'received']);
		} finally {
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
		await expect(readShellyRelayStatus(peer, dispatching)).resolves.toEqual({ sent: false });
		expect(dispatching).toHaveBeenCalledTimes(4);
	});
});
