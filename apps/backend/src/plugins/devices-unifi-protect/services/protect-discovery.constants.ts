import { PROTECT_DEFAULT_PORT } from '../devices-unifi-protect.constants';

export const PROTECT_DISCOVERY_PORT = 10001;
export const PROTECT_DISCOVERY_MULTICAST_ADDRESS = '233.89.188.1';
export const PROTECT_DISCOVERY_REQUEST_V1 = Buffer.from([0x01, 0x00, 0x00, 0x00]);
export const PROTECT_DISCOVERY_REQUEST_V2 = Buffer.from([0x02, 0x08, 0x00, 0x00]);
export const PROTECT_DISCOVERY_WINDOW_MS = 5000;
/** Send rounds at 0, WINDOW/3 and 2*WINDOW/3. */
export const PROTECT_DISCOVERY_RESEND_ROUNDS = 3;
/** The live console reply is 402 bytes. */
export const PROTECT_DISCOVERY_MAX_DATAGRAM_BYTES = 4096;
export const PROTECT_DISCOVERY_MAX_TLV_VALUE_BYTES = 1024;
export const PROTECT_DISCOVERY_MAX_CANDIDATES = 16;
/** Tracked identities of non-console devices. */
export const PROTECT_DISCOVERY_MAX_OTHER_DEVICES = 256;

export const PROTECT_PROBE_TIMEOUT_MS = 4000;
export const PROTECT_PROBE_MAX_BODY_BYTES = 65536;
export const PROTECT_PROBE_CONCURRENCY = 8;
export const PROTECT_PROBE_DEFAULT_PORT = PROTECT_DEFAULT_PORT;
export const PROTECT_PROBE_SYSTEM_PATH = '/api/system';
export const PROTECT_PROBE_PROTECT_PATH = '/proxy/protect/api';

export enum ProtectDiscoveryParseFailure {
	TRUNCATED_HEADER = 'truncated_header',
	OVERSIZED_DATAGRAM = 'oversized_datagram',
	UNSUPPORTED_VERSION = 'unsupported_version',
	TRUNCATED_DATAGRAM = 'truncated_datagram',
	TRUNCATED_TLV = 'truncated_tlv',
	OVERSIZED_TLV = 'oversized_tlv',
}

export enum ProtectPresence {
	PRESENT = 'present',
	ABSENT = 'absent',
	UNKNOWN = 'unknown',
}

export enum ProtectProbeStatus {
	CONSOLE = 'console',
	NOT_CONSOLE = 'not_console',
	UNREACHABLE = 'unreachable',
}

export enum ProtectProbeFailure {
	TIMEOUT = 'timeout',
	CONNECTION_REFUSED = 'connection_refused',
	HOST_UNREACHABLE = 'host_unreachable',
	DNS_FAILURE = 'dns_failure',
	TLS_FAILURE = 'tls_failure',
}

export type ProtectTransportErrorKind = 'timeout' | 'refused' | 'unreachable' | 'dns' | 'tls' | 'protocol';
