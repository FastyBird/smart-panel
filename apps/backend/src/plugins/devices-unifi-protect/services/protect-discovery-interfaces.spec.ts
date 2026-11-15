import * as os from 'os';

import { computeBroadcastAddress, mapSocketErrorCode, selectScanInterfaces } from './protect-discovery-interfaces';

const info = (address: string, netmask: string, extra: Partial<os.NetworkInterfaceInfo> = {}) =>
	({
		address,
		netmask,
		family: 'IPv4',
		internal: false,
		mac: '00:00:00:00:00:00',
		cidr: null,
		...extra,
	}) as os.NetworkInterfaceInfo;

describe('computeBroadcastAddress', () => {
	it.each([
		['192.168.1.20', '255.255.255.0', '192.168.1.255'],
		['10.0.5.9', '255.255.252.0', '10.0.7.255'],
		['172.16.3.4', '255.255.0.0', '172.16.255.255'],
	])('computeBroadcastAddress %s %s', (a, m, b) => expect(computeBroadcastAddress(a, m)).toBe(b));

	it.each([
		['100.64.0.5', '255.255.255.255'],
		['10.0.0.1', '255.255.255.254'],
		['bad', '255.255.255.0'],
		['10.0.0.1', 'nope'],
		['10.0.0.1', '255.0.255.0'],
		['10.0.0.256', '255.255.255.0'],
	])('computeBroadcastAddress returns null for %s %s', (a, m) => expect(computeBroadcastAddress(a, m)).toBeNull());
});

describe('selectScanInterfaces', () => {
	it('keeps non-internal IPv4 interfaces with a broadcast address and skips lo, IPv6, /32 and 169.254/16', () => {
		const result = selectScanInterfaces({
			lo0: [info('127.0.0.1', '255.0.0.0', { internal: true })],
			en0: [
				info('192.168.1.20', '255.255.255.0'),
				{ ...info('fe80::1', 'ffff:ffff:ffff:ffff::'), family: 'IPv6' } as os.NetworkInterfaceInfo,
			],
			tun0: [info('100.64.0.5', '255.255.255.255')],
			en1: [info('169.254.3.4', '255.255.0.0')],
			en2: undefined,
		});

		expect(result).toEqual([{ name: 'en0', address: '192.168.1.20', broadcast: '192.168.1.255' }]);
	});

	it('orders by name then address and keeps two addresses on one interface', () => {
		const result = selectScanInterfaces({
			en1: [info('10.0.0.5', '255.255.255.0')],
			en0: [info('192.168.1.20', '255.255.255.0'), info('10.1.0.2', '255.255.255.0')],
		});

		expect(result.map((i) => `${i.name}/${i.address}`)).toEqual(['en0/10.1.0.2', 'en0/192.168.1.20', 'en1/10.0.0.5']);
	});
});

describe('mapSocketErrorCode', () => {
	it.each([
		['EACCES', 'permission_denied'],
		['EPERM', 'permission_denied'],
		['EADDRNOTAVAIL', 'address_unavailable'],
		['ENETUNREACH', 'network_unreachable'],
		['EHOSTUNREACH', 'network_unreachable'],
		['ENETDOWN', 'network_unreachable'],
		['EBADF', 'socket_error'],
	])('mapSocketErrorCode %s -> %s', (code, expected) =>
		expect(mapSocketErrorCode(Object.assign(new Error('x'), { code }))).toBe(expected),
	);

	it('maps a non-error to socket_error', () => expect(mapSocketErrorCode('x')).toBe('socket_error'));
});
