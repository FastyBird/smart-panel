import * as os from 'os';

import { ProtectInterfaceErrorCode } from './protect-discovery.constants';

export interface ProtectScanInterface {
	name: string;
	address: string;
	broadcast: string;
}

const parseIpv4 = (value: string): number[] | null => {
	const parts = value.split('.');

	if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part))) {
		return null;
	}

	const octets = parts.map(Number);

	return octets.every((octet) => octet <= 255) ? octets : null;
};

/** Subnet broadcast address; `null` for /31, /32, a non-contiguous mask or malformed input. */
export const computeBroadcastAddress = (address: string, netmask: string): string | null => {
	const ip = parseIpv4(address);
	const mask = parseIpv4(netmask);

	if (ip === null || mask === null) {
		return null;
	}

	const maskValue = mask.reduce((acc, octet) => acc * 256 + octet, 0);
	const hostMask = 0xffffffff - maskValue;

	// A valid netmask has all host bits at the end; host bits must number at least two (not /31, /32).
	if (hostMask < 3 || hostMask === 0xffffffff || (hostMask & (hostMask + 1)) !== 0) {
		return null;
	}

	const broadcast = ip.map((octet, index) => (octet | (~mask[index] & 0xff)) & 0xff).join('.');

	// Never the limited broadcast address (it fails with EADDRNOTAVAIL on macOS and is not a subnet broadcast).
	return broadcast === '255.255.255.255' ? null : broadcast;
};

export const selectScanInterfaces = (interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>): ProtectScanInterface[] => {
	const selected: ProtectScanInterface[] = [];

	for (const [name, infos] of Object.entries(interfaces)) {
		for (const info of infos ?? []) {
			if (info.family !== 'IPv4' || info.internal || info.address.startsWith('169.254.')) {
				continue;
			}

			const broadcast = computeBroadcastAddress(info.address, info.netmask);

			if (broadcast !== null) {
				selected.push({ name, address: info.address, broadcast });
			}
		}
	}

	return selected.sort((a, b) =>
		a.name < b.name ? -1 : a.name > b.name ? 1 : a.address < b.address ? -1 : a.address > b.address ? 1 : 0,
	);
};

export const mapSocketErrorCode = (error: unknown): ProtectInterfaceErrorCode => {
	const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;

	switch (code) {
		case 'EACCES':
		case 'EPERM':
			return ProtectInterfaceErrorCode.PERMISSION_DENIED;
		case 'EADDRNOTAVAIL':
			return ProtectInterfaceErrorCode.ADDRESS_UNAVAILABLE;
		case 'ENETUNREACH':
		case 'EHOSTUNREACH':
		case 'ENETDOWN':
			return ProtectInterfaceErrorCode.NETWORK_UNREACHABLE;
		default:
			return ProtectInterfaceErrorCode.SOCKET_ERROR;
	}
};
