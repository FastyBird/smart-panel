import type { RemoteInfo } from 'dgram';
import { createRequire } from 'module';

import { installCiaoReceiveGuard } from './ciao-receive-guard';

interface NetworkInterface {
	name: string;
	loopback: boolean;
	ipv4?: string;
	ip4Netmask?: string;
	ipv4Netaddress?: string;
}

const networkInterface = (): NetworkInterface => ({
	name: 'example0',
	loopback: false,
	ipv4: '192.0.2.1',
	ip4Netmask: '255.255.255.0',
	ipv4Netaddress: '192.0.2.0',
});

const createReceiver = (currentInterface: NetworkInterface | undefined = networkInterface()) => ({
	bound: true,
	networkManager: {
		getInterface: jest.fn().mockReturnValue(currentInterface),
		isLoopbackNetaddressV4: jest.fn().mockReturnValue(false),
	},
	checkIfPacketWasPreviouslySentFromUs: jest.fn().mockReturnValue(false),
	handler: { handleQuery: jest.fn(), handleResponse: jest.fn() },
});

type ReceiveHandler = (
	this: ReturnType<typeof createReceiver>,
	name: string,
	buffer: Buffer,
	rinfo: RemoteInfo,
	family: 'IPv4' | 'IPv6',
) => void;

// Load the real dependency from HAP's resolution context, not a mocked substitute.
const hapRequire = createRequire(require.resolve('@homebridge/hap-nodejs'));
const { MDNSServer } = hapRequire('@homebridge/ciao/lib/MDNSServer') as {
	MDNSServer: { prototype: { handleMessage: ReceiveHandler } };
};
const original = MDNSServer.prototype.handleMessage;
const ipv4Sender: RemoteInfo = { address: '192.0.2.10', family: 'IPv4', port: 5353, size: 12 };
const packet = Buffer.alloc(12); // Valid empty DNS query; no socket/network activity is needed.

describe('HomeKit ciao receive guard', () => {
	afterEach(() => {
		MDNSServer.prototype.handleMessage = original;
	});

	it('reproduces the real unguarded assertion when an interface loses IPv4', () => {
		const receiver = createReceiver({ name: 'example0', loopback: false });

		expect(() => {
			original.call(receiver, 'example0', packet, ipv4Sender, 'IPv4');
		}).toThrow('IP address version must match. Netmask cannot have a version different from the address!');
	});

	it.each([
		{ reason: 'IPv4 lost', current: { name: 'example0', loopback: false } },
		{ reason: 'mask missing', current: { ...networkInterface(), ip4Netmask: undefined } },
		{ reason: 'mask family mismatch', current: { ...networkInterface(), ip4Netmask: 'ffff:ffff:ffff:ffff::' } },
		{ reason: 'address malformed', current: { ...networkInterface(), ipv4: 'invalid' } },
	])('drops an IPv4 receive when $reason', ({ current }) => {
		const receiver = createReceiver(current);
		installCiaoReceiveGuard();

		expect(() => {
			MDNSServer.prototype.handleMessage.call(receiver, 'example0', packet, ipv4Sender, 'IPv4');
		}).not.toThrow();
		expect(receiver.handler.handleQuery).not.toHaveBeenCalled();
	});

	it.each([
		{ family: 'IPv4' as const, sender: { ...ipv4Sender, address: 'fe80::10', family: 'IPv6' } },
		{ family: 'IPv4' as const, sender: { ...ipv4Sender, address: 'invalid' } },
		{ family: 'IPv6' as const, sender: ipv4Sender },
	])('drops malformed or mismatched sender families (%j)', ({ family, sender }) => {
		const receiver = createReceiver();
		installCiaoReceiveGuard();

		expect(() => {
			MDNSServer.prototype.handleMessage.call(receiver, 'example0', packet, sender, family);
		}).not.toThrow();
		expect(receiver.handler.handleQuery).not.toHaveBeenCalled();
	});

	it.each([
		{ family: 'IPv4' as const, sender: ipv4Sender, current: networkInterface(), interfaceName: 'example0' },
		{
			family: 'IPv6' as const,
			sender: { ...ipv4Sender, address: 'fe80::10%example0', family: 'IPv6' },
			current: { name: 'example0', loopback: false },
			interfaceName: 'example0/6',
		},
	])('delivers valid $family queries without changing the endpoint', ({ family, sender, current, interfaceName }) => {
		const receiver = createReceiver(current);
		installCiaoReceiveGuard();

		MDNSServer.prototype.handleMessage.call(receiver, 'example0', packet, sender, family);

		expect(receiver.handler.handleQuery).toHaveBeenCalledTimes(1);
		expect(receiver.handler.handleQuery).toHaveBeenCalledWith(expect.anything(), {
			address: sender.address,
			port: sender.port,
			interface: interfaceName,
		});
	});

	it('retains upstream filtering of a non-loopback packet on a loopback interface', () => {
		const receiver = createReceiver({
			name: 'lo',
			loopback: true,
			ipv4: '127.0.0.1',
			ip4Netmask: '255.0.0.0',
			ipv4Netaddress: '127.0.0.0',
		});
		installCiaoReceiveGuard();

		MDNSServer.prototype.handleMessage.call(receiver, 'lo', packet, ipv4Sender, 'IPv4');

		expect(receiver.handler.handleQuery).not.toHaveBeenCalled();
	});

	it('installs on HAP’s actual ciao dependency only once', () => {
		installCiaoReceiveGuard();
		const guarded = MDNSServer.prototype.handleMessage;
		expect(guarded).not.toBe(original);
		installCiaoReceiveGuard();
		expect(MDNSServer.prototype.handleMessage).toBe(guarded);
		const receiver = createReceiver();

		guarded.call(receiver, 'example0', packet, ipv4Sender, 'IPv4');

		expect(receiver.handler.handleQuery).toHaveBeenCalledTimes(1);
	});

	it('keeps unrelated upstream errors visible and leaves the subnet assertion intact', () => {
		const receiver = createReceiver();
		const error = new Error('unexpected upstream failure');
		receiver.checkIfPacketWasPreviouslySentFromUs.mockImplementation(() => {
			throw error;
		});
		installCiaoReceiveGuard();
		const { getNetAddress } = hapRequire('@homebridge/ciao/lib/util/domain-formatter') as {
			getNetAddress: (address: string, mask: string) => string;
		};

		expect(() => {
			MDNSServer.prototype.handleMessage.call(receiver, 'example0', packet, ipv4Sender, 'IPv4');
		}).toThrow(error);
		expect(() => getNetAddress('192.0.2.1', 'ffff:ffff::')).toThrow('IP address version must match.');
	});
});
