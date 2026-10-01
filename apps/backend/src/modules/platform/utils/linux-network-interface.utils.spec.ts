import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';

import { readLinuxDefaultNetworkInterface } from './linux-network-interface.utils';

jest.mock('node:child_process', () => {
	const { promisify } = jest.requireActual<typeof import('node:util')>('node:util');
	const execFile = jest.fn();

	Object.defineProperty(execFile, promisify.custom, { value: jest.fn() });

	return { execFile };
});

const execFileAsync = jest.mocked(promisify(execFile));
const address = (ip: string): os.NetworkInterfaceInfo => ({
	address: ip,
	netmask: '255.255.255.0',
	family: 'IPv4',
	mac: '00:11:22:33:44:55',
	internal: false,
	cidr: `${ip}/24`,
});
const ipv6Address = (ip: string, scopeid: number): os.NetworkInterfaceInfoIPv6 => ({
	address: ip,
	netmask: 'ffff:ffff:ffff:ffff::',
	family: 'IPv6',
	mac: '00:11:22:33:44:55',
	internal: false,
	cidr: `${ip}/64`,
	scopeid,
});

describe('readLinuxDefaultNetworkInterface', () => {
	beforeEach(() => {
		execFileAsync.mockReset();
		execFileAsync.mockResolvedValue({ stdout: '[{"dev":"eth0"}]', stderr: '' });
		jest.spyOn(os, 'networkInterfaces').mockReturnValue({
			lo: [{ ...address('127.0.0.1'), internal: true }],
			wlan0: [address('192.0.2.10')],
			eth0: [address('192.0.2.20')],
		});
	});

	afterEach(() => jest.restoreAllMocks());

	it('selects the routed interface rather than the first external interface', async () => {
		await expect(readLinuxDefaultNetworkInterface()).resolves.toEqual({
			iface: 'eth0',
			ip4: '192.0.2.20',
			ip6: '',
			mac: '00:11:22:33:44:55',
		});
		expect(execFileAsync).toHaveBeenCalledWith('ip', ['-j', 'route', 'show', 'default'], {
			timeout: 2000,
			maxBuffer: 64 * 1024,
		});
	});

	it('uses an alias-only routed interface and reports its base name', async () => {
		jest.mocked(os.networkInterfaces).mockReturnValue({
			wlan0: [address('192.0.2.10')],
			'eth0:1': [address('192.0.2.20')],
		});

		await expect(readLinuxDefaultNetworkInterface()).resolves.toEqual({
			iface: 'eth0',
			ip4: '192.0.2.20',
			ip6: '',
			mac: '00:11:22:33:44:55',
		});
	});

	it('prefers the exact routed interface even when an alias appears first', async () => {
		jest.mocked(os.networkInterfaces).mockReturnValue({
			'eth0:1': [address('192.0.2.30')],
			eth0: [address('192.0.2.20')],
		});

		await expect(readLinuxDefaultNetworkInterface()).resolves.toMatchObject({ iface: 'eth0', ip4: '192.0.2.20' });
	});

	it.each(['eth01', 'eth01:1'])('does not confuse %s with an alias of eth0', async (name) => {
		jest.mocked(os.networkInterfaces).mockReturnValue({
			wlan0: [address('192.0.2.10')],
			[name]: [address('192.0.2.30')],
		});

		await expect(readLinuxDefaultNetworkInterface()).resolves.toMatchObject({ iface: 'wlan0', ip4: '192.0.2.10' });
	});

	it('keeps the event loop available while the route probe is pending', async () => {
		let finish: (value: { stdout: string; stderr: string }) => void;

		const probe = new Promise<{ stdout: string; stderr: string }>((resolve) => (finish = resolve));

		execFileAsync.mockReturnValue(probe as ReturnType<typeof execFileAsync>);
		let completed = false;
		const pending = readLinuxDefaultNetworkInterface().then((result) => {
			completed = true;

			return result;
		});

		await new Promise<void>((resolve) => setImmediate(resolve));
		expect(completed).toBe(false);
		finish({ stdout: '[{"dev":"eth0"}]', stderr: '' });
		await expect(pending).resolves.toMatchObject({ iface: 'eth0' });
	});

	it.each(['ENOENT', 'ETIMEDOUT', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'])(
		'falls back to an external interface when the bounded probe fails with %s',
		async (code) => {
			execFileAsync.mockRejectedValue(Object.assign(new Error('probe failed'), { code }));

			await expect(readLinuxDefaultNetworkInterface()).resolves.toMatchObject({ iface: 'wlan0', ip4: '192.0.2.10' });
		},
	);

	it.each(['invalid JSON', '{}', '[null,{}, {"dev": 123}]', '[{"dev":"missing"}]', '[]'])(
		'handles missing or malformed routing information: %s',
		async (stdout) => {
			execFileAsync.mockResolvedValue({ stdout, stderr: '' });

			await expect(readLinuxDefaultNetworkInterface()).resolves.toMatchObject({ iface: 'wlan0' });
		},
	);

	it('observes route and address changes on the next sample', async () => {
		await expect(readLinuxDefaultNetworkInterface()).resolves.toMatchObject({ iface: 'eth0' });
		execFileAsync.mockResolvedValue({ stdout: '[{"dev":"wlan0"}]', stderr: '' });
		jest.mocked(os.networkInterfaces).mockReturnValue({ wlan0: [address('192.0.2.30')] });

		await expect(readLinuxDefaultNetworkInterface()).resolves.toMatchObject({ iface: 'wlan0', ip4: '192.0.2.30' });
	});

	it('prefers routable addresses while retaining link-local fallback', async () => {
		jest.mocked(os.networkInterfaces).mockReturnValue({
			eth0: [address('169.254.1.1'), address('192.0.2.20'), ipv6Address('fe80::1', 2), ipv6Address('2001:db8::1', 0)],
		});
		await expect(readLinuxDefaultNetworkInterface()).resolves.toMatchObject({ ip4: '192.0.2.20', ip6: '2001:db8::1' });
		jest.mocked(os.networkInterfaces).mockReturnValue({ eth0: [address('169.254.1.1'), ipv6Address('fe80::1', 2)] });
		await expect(readLinuxDefaultNetworkInterface()).resolves.toMatchObject({ ip4: '169.254.1.1', ip6: 'fe80::1' });
	});

	it('retains the IPv6 scope fallback when no default route exists', async () => {
		execFileAsync.mockResolvedValue({ stdout: '[]', stderr: '' });
		jest.mocked(os.networkInterfaces).mockReturnValue({
			wlan0: [ipv6Address('fe80::1', 3)],
			eth0: [ipv6Address('fe80::2', 2)],
		});

		await expect(readLinuxDefaultNetworkInterface()).resolves.toMatchObject({ iface: 'eth0', ip4: '', ip6: 'fe80::2' });
	});

	it('returns empty status fields when only loopback is present', async () => {
		jest.mocked(os.networkInterfaces).mockReturnValue({ lo: [{ ...address('127.0.0.1'), internal: true }] });

		await expect(readLinuxDefaultNetworkInterface()).resolves.toEqual({ iface: '', ip4: '', ip6: '', mac: '' });
	});
});
