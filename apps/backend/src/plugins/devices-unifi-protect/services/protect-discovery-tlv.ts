import { formatMac, isDnsHostname, sanitizeText } from './protect-discovery-text';
import {
	PROTECT_DISCOVERY_MAX_DATAGRAM_BYTES,
	PROTECT_DISCOVERY_MAX_TLV_VALUE_BYTES,
	ProtectDiscoveryParseFailure,
} from './protect-discovery.constants';

const HEADER_BYTES = 4;
const TLV_HEADER_BYTES = 3;
const UUID_PATTERN = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export interface ProtectDiscoveryAddress {
	mac: string;
	ip: string;
}

export interface ProtectDiscoveryReply {
	headerVersion: 0 | 1 | 2;
	hwaddr: string | null;
	addresses: ProtectDiscoveryAddress[];
	firmware: string | null;
	hostname: string | null;
	shortModel: string | null;
	directConnectDomain: string | null;
	uuid: string | null;
}

export type ProtectDiscoveryParseResult =
	| { ok: true; reply: ProtectDiscoveryReply }
	| { ok: false; reason: ProtectDiscoveryParseFailure };

const fail = (reason: ProtectDiscoveryParseFailure): ProtectDiscoveryParseResult => ({ ok: false, reason });

const decodeText = (value: Uint8Array): string | null => {
	try {
		return sanitizeText(new TextDecoder('utf-8', { fatal: true }).decode(value));
	} catch {
		return null;
	}
};

const decodeUuid = (value: Uint8Array): string | null => {
	const text = decodeText(value);

	return text !== null && UUID_PATTERN.test(text) ? text.toLowerCase() : null;
};

const decodeDomain = (value: Uint8Array): string | null => {
	const text = decodeText(value);

	return text !== null && isDnsHostname(text) ? text : null;
};

/** Parses a discovery reply; every failure is an explicit result, it never throws. */
export const parseDiscoveryReply = (datagram: Uint8Array): ProtectDiscoveryParseResult => {
	if (datagram.length < HEADER_BYTES) {
		return fail(ProtectDiscoveryParseFailure.TRUNCATED_HEADER);
	}

	if (datagram.length > PROTECT_DISCOVERY_MAX_DATAGRAM_BYTES) {
		return fail(ProtectDiscoveryParseFailure.OVERSIZED_DATAGRAM);
	}

	const view = new DataView(datagram.buffer, datagram.byteOffset, datagram.byteLength);
	const version = view.getUint8(0);

	if (version !== 0 && version !== 1 && version !== 2) {
		return fail(ProtectDiscoveryParseFailure.UNSUPPORTED_VERSION);
	}

	const end = HEADER_BYTES + view.getUint16(2, false);

	if (end > datagram.length) {
		return fail(ProtectDiscoveryParseFailure.TRUNCATED_DATAGRAM);
	}

	const reply: ProtectDiscoveryReply = {
		headerVersion: version,
		hwaddr: null,
		addresses: [],
		firmware: null,
		hostname: null,
		shortModel: null,
		directConnectDomain: null,
		uuid: null,
	};
	let seenHwaddr = false;
	let seenFirmware = false;
	let seenHostname = false;
	let seenShortModel = false;
	let seenDomain = false;
	let seenUuid = false;
	let offset = HEADER_BYTES;

	while (offset < end) {
		if (offset + TLV_HEADER_BYTES > end) {
			return fail(ProtectDiscoveryParseFailure.TRUNCATED_TLV);
		}

		const type = view.getUint8(offset);
		const length = view.getUint16(offset + 1, false);

		if (length > PROTECT_DISCOVERY_MAX_TLV_VALUE_BYTES) {
			return fail(ProtectDiscoveryParseFailure.OVERSIZED_TLV);
		}

		const start = offset + TLV_HEADER_BYTES;

		if (start + length > end) {
			return fail(ProtectDiscoveryParseFailure.TRUNCATED_TLV);
		}

		const value = datagram.subarray(start, start + length);

		switch (type) {
			case 0x01:
				if (!seenHwaddr) {
					seenHwaddr = true;
					reply.hwaddr = length === 6 ? formatMac(value) : null;
				}

				break;
			case 0x02:
				if (length === 10) {
					reply.addresses.push({ mac: formatMac(value.subarray(0, 6)), ip: Array.from(value.subarray(6)).join('.') });
				}

				break;
			case 0x03:
				if (!seenFirmware) {
					seenFirmware = true;
					reply.firmware = decodeText(value);
				}

				break;
			case 0x0b:
				if (!seenHostname) {
					seenHostname = true;
					reply.hostname = decodeText(value);
				}

				break;
			case 0x0c:
				if (!seenShortModel) {
					seenShortModel = true;
					reply.shortModel = decodeText(value);
				}

				break;
			case 0x30:
				if (!seenDomain) {
					seenDomain = true;
					reply.directConnectDomain = decodeDomain(value);
				}

				break;
			case 0x33:
				if (!seenUuid) {
					seenUuid = true;
					reply.uuid = decodeUuid(value);
				}

				break;
			default:
				break;
		}

		offset = start + length;
	}

	return { ok: true, reply };
};

export const replyIdentityMac = (reply: ProtectDiscoveryReply): string | null =>
	reply.hwaddr ?? reply.addresses[0]?.mac ?? null;

export const isProtectConsoleCandidate = (reply: ProtectDiscoveryReply): boolean =>
	replyIdentityMac(reply) !== null && (reply.shortModel !== null || reply.directConnectDomain !== null);
