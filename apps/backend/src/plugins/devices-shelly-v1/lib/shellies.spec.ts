import { EventEmitter } from 'events';

import shellies, { subscribeShellyTemperatures } from './shellies';

describe('raw Shelly Gen1 CoIoT temperature ingress', () => {
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
