import { EventEmitter } from 'events';

import shellies, { readShellyTemperature, subscribeShellyTemperatures } from './shellies';

describe('raw Shelly Gen1 CoIoT temperature ingress', () => {
	it('validates the captured host, hardware, reply type and mapped raw field on a unicast status response', async () => {
		const library = shellies as typeof shellies & { _listener: EventEmitter };
		const packet = {
			deviceType: 'SHHT-1',
			deviceId: 'TEMP',
			host: '127.0.0.1',
			serial: 1,
			payload: { G: [[0, 3101, 21.25]] },
			msg: { code: '2.05', _packet: { ack: true } },
		};
		const coap = jest.requireActual<{ getStatus: (host: string) => Promise<unknown> }>('shellies/lib/coap');
		const read = jest.spyOn(coap, 'getStatus');
		try {
			library._listener.emit('statusUpdate', packet);
			const peer = library.getDevice(packet.deviceType, packet.deviceId);
			read.mockResolvedValueOnce(packet);
			await expect(readShellyTemperature(peer)).resolves.toEqual({ serial: 1, value: 21.25 });
			expect(read).toHaveBeenCalledWith(packet.host);
			for (const altered of [
				{ host: '127.0.0.2' },
				{ deviceId: 'OTHER' },
				{ deviceType: 'OTHER' },
				{ serial: 0 },
				{ payload: { G: [[0, 3103, 40]] } },
				{ msg: { code: '0.30', _packet: { ack: false } } },
				{ msg: { code: '2.05', _packet: { ack: false } } },
			]) {
				read.mockResolvedValueOnce({ ...packet, ...altered });
				await expect(readShellyTemperature(peer)).resolves.toBeNull();
			}
		} finally {
			read.mockRestore();
			library.removeAllDevices();
		}
	});
	it('uses the installed library’s device-specific mapping and original uncoerced packet field', () => {
		const actual = shellies as typeof shellies & { _listener: EventEmitter };
		const reports = jest.fn();
		const unsubscribe = subscribeShellyTemperatures(reports);
		try {
			const packet = {
				deviceType: 'SHHT-1',
				deviceId: 'ITEMP',
				host: '127.0.0.1',
				serial: 17,
				payload: {
					G: [
						[0, 3101, 20.25],
						[0, 3103, 51],
					],
				},
			};
			actual._listener.emit('statusUpdate', packet);
			const peer = actual.getDevice(packet.deviceType, packet.deviceId);
			expect(reports).toHaveBeenCalledWith(peer, 17, 20.25);
			actual._listener.emit('statusUpdate', { ...packet, serial: 18, payload: { G: [[0, 3103, 52]] } });
			actual._listener.emit('statusUpdate', { ...packet, serial: 19, payload: { G: [[0, 3101, null]] } });
			expect(reports).toHaveBeenCalledTimes(2);
			expect(reports).toHaveBeenLastCalledWith(peer, 19, null);
			unsubscribe();
			actual._listener.emit('statusUpdate', { ...packet, serial: 20 });
			expect(reports).toHaveBeenCalledTimes(2);
		} finally {
			unsubscribe();
			actual.removeAllDevices();
		}
	});
});
