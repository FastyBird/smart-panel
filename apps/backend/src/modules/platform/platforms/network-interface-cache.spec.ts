import os from 'os';
import si, { Systeminformation } from 'systeminformation';

import { readLinuxDefaultNetworkInterface } from '../utils/linux-network-interface.utils';

import { GenericPlatform } from './generic.platform';

jest.mock('../utils/linux-network-interface.utils');

class TestPlatform extends GenericPlatform {
	readNetworkInterface() {
		return this.cachedNetworkInterfaces();
	}
}

describe('platform default network interface sampling', () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	it('uses the nonblocking Linux probe and refreshes after the existing one-minute TTL', async () => {
		jest.spyOn(os, 'platform').mockReturnValue('linux');
		const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
		const synchronousProbe = jest.spyOn(si, 'networkInterfaces');
		const first = { iface: 'eth0', ip4: '192.0.2.20', ip6: '', mac: '' };
		const second = { ...first, iface: 'wlan0', ip4: '192.0.2.10' };

		jest.mocked(readLinuxDefaultNetworkInterface).mockResolvedValueOnce(first).mockResolvedValueOnce(second);
		const platform = new TestPlatform();

		await expect(platform.readNetworkInterface()).resolves.toEqual(first);
		now.mockReturnValue(60_999);
		await expect(platform.readNetworkInterface()).resolves.toEqual(first);
		now.mockReturnValue(61_000);
		await expect(platform.readNetworkInterface()).resolves.toEqual(second);
		expect(readLinuxDefaultNetworkInterface).toHaveBeenCalledTimes(2);
		expect(synchronousProbe).not.toHaveBeenCalled();
	});

	it('preserves systeminformation sampling on other operating systems', async () => {
		jest.spyOn(os, 'platform').mockReturnValue('darwin');
		const networkInterface = { iface: 'en0', ip4: '192.0.2.30' } as Systeminformation.NetworkInterfacesData;
		const probe = jest.spyOn(si, 'networkInterfaces').mockResolvedValue(networkInterface);

		await expect(new TestPlatform().readNetworkInterface()).resolves.toEqual(networkInterface);
		expect(probe).toHaveBeenCalledWith('default');
		expect(readLinuxDefaultNetworkInterface).not.toHaveBeenCalled();
	});
});
