import type { RemoteInfo } from 'dgram';
import { createRequire } from 'module';
import { isIPv4, isIPv6 } from 'net';

interface CiaoNetworkInterface {
	ipv4?: string;
	ip4Netmask?: string;
}

interface CiaoReceiveContext {
	bound: boolean;
	networkManager: { getInterface: (name: string) => CiaoNetworkInterface | undefined };
}

type CiaoReceiveHandler = (
	this: CiaoReceiveContext,
	name: string,
	buffer: Buffer,
	rinfo: RemoteInfo,
	family: 'IPv4' | 'IPv6',
) => void;

const RECEIVE_GUARD = Symbol.for('fastybird.homekit.ciao-receive-guard');
type GuardedReceiveHandler = CiaoReceiveHandler & { [RECEIVE_GUARD]?: boolean };

/**
 * ciao 1.3.12 keeps its IPv4 socket when an interface loses IPv4 but retains IPv6.
 * A queued/cross-interface packet then reaches subnet calculation without an IPv4
 * netmask, throwing outside ciao's packet error handling and terminating the backend.
 * Guard only that receive boundary; valid traffic retains ciao's subnet/loopback checks.
 */
export function installCiaoReceiveGuard(): void {
	// Resolve the dependency used by HAP, including nested npm/pnpm installations.
	const hapRequire = createRequire(require.resolve('@homebridge/hap-nodejs'));
	const { MDNSServer } = hapRequire('@homebridge/ciao/lib/MDNSServer') as {
		MDNSServer?: { prototype?: { handleMessage?: GuardedReceiveHandler } };
	};
	const prototype = MDNSServer?.prototype;
	const original = prototype?.handleMessage;
	if (!prototype || typeof original !== 'function') {
		throw new Error('The HomeKit mDNS receive handler is incompatible with the ciao receive guard.');
	}
	if (original[RECEIVE_GUARD]) {
		return;
	}

	const guarded: GuardedReceiveHandler = function (name, buffer, rinfo, family): void {
		if (this.bound) {
			if (family === 'IPv4') {
				const networkInterface = this.networkManager.getInterface(name);
				if (
					!isIPv4(rinfo.address) ||
					(networkInterface && (!isIPv4(networkInterface.ipv4 ?? '') || !isIPv4(networkInterface.ip4Netmask ?? '')))
				) {
					return;
				}
			} else if (family !== 'IPv6' || !isIPv6(rinfo.address)) {
				return;
			}
		}
		original.call(this, name, buffer, rinfo, family);
	};
	Object.defineProperty(guarded, RECEIVE_GUARD, { value: true });
	prototype.handleMessage = guarded;
}
