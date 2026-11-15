import { parseProbeHost } from './protect-probe-host.validator';

describe('parseProbeHost', () => {
	it.each([
		['192.168.1.10', 'ipv4'],
		['127.0.0.1', 'ipv4'],
		['10.0.0.1', 'ipv4'],
		['unifi', 'hostname'],
		['unifi.local', 'hostname'],
		[' UniFi.Local ', 'hostname'],
		['fd00::1', 'ipv6'],
		['::1', 'ipv6'],
	])('accepts %j', (value, kind) => {
		expect(parseProbeHost(value)).toEqual({ host: value.trim().toLowerCase(), kind });
	});

	it.each([
		'',
		'   ',
		5,
		null,
		undefined,
		{},
		'http://192.168.1.10',
		'192.168.1.10:443',
		'192.168.1.10/api',
		'192.168.1.10?x=1',
		'user@host',
		'host name',
		'0.0.0.0',
		'255.255.255.255',
		'224.0.0.1',
		'239.255.255.250',
		'169.254.169.254',
		'fe80::1',
		'febf::1',
		'ff02::1',
		'::',
		'999.1.1.1',
		'1.2.3',
		'host_name',
		'a'.repeat(254),
		`${'a'.repeat(64)}.local`,
		'[::1]',
		'::ffff:169.254.169.254',
		'::ffff:a9fe:a9fe',
		'fe80::1%en0',
	])('rejects %j', (value) => {
		expect(parseProbeHost(value)).toBeNull();
	});

	it('accepts the neighbours of the rejected ranges', () => {
		expect(parseProbeHost('223.255.255.255')?.kind).toBe('ipv4');
		expect(parseProbeHost('169.253.1.1')?.kind).toBe('ipv4');
		expect(parseProbeHost('169.255.1.1')?.kind).toBe('ipv4');
		expect(parseProbeHost('fec0::1')?.kind).toBe('ipv6');
		expect(parseProbeHost('fe7f::1')?.kind).toBe('ipv6');
	});

	it('accepts an IPv4-mapped IPv6 address of a private host', () => {
		expect(parseProbeHost('::ffff:192.168.1.10')).toEqual({ host: '::ffff:192.168.1.10', kind: 'ipv6' });
	});
});
