import { isValidProtectServerName } from '../validators/protect-config.validators';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const MAC_HEX = /^[0-9a-f]{12}$/;

/** Trimmed text of 1..maxLength characters without control characters, else null. */
export const sanitizeText = (value: string, maxLength: number = 128): string | null => {
	const trimmed = value.trim();

	if (trimmed.length === 0 || trimmed.length > maxLength || CONTROL_CHARACTERS.test(trimmed)) {
		return null;
	}

	return trimmed;
};

const colonSeparated = (hex: string): string => hex.match(/.{2}/g).join(':');

/** Six bytes as lowercase colon-separated hex. */
export const formatMac = (bytes: Uint8Array): string =>
	Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(':');

/** `AA-BB-…`, `aabb.cc…` and `aa:bb:…` to the lowercase colon form, else null. */
export const normalizeMacString = (value: string): string | null => {
	const hex = value.trim().toLowerCase().replace(/[:.-]/g, '');

	return MAC_HEX.test(hex) ? colonSeparated(hex) : null;
};

/** Lowercase RFC 1123 DNS name; the grammar is UP-5's, not a second one. */
export const isDnsHostname = (value: string): boolean =>
	value === value.toLowerCase() && isValidProtectServerName(value);
