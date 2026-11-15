import { PROTECT_MIN_VERSION } from '../devices-unifi-protect.constants';

export interface ProtectVersion {
	major: number;
	minor: number;
	patch: number;
}

const VERSION_PATTERN = /^(\d+)\.(\d+)(?:\.(\d+))?(?:[-+][0-9A-Za-z.-]+)?$/;

export function parseProtectVersion(value: unknown): ProtectVersion | null {
	if (typeof value !== 'string') {
		return null;
	}

	const match = VERSION_PATTERN.exec(value);

	if (!match) {
		return null;
	}

	return { major: Number(match[1]), minor: Number(match[2]), patch: match[3] === undefined ? 0 : Number(match[3]) };
}

export function compareProtectVersions(a: ProtectVersion, b: ProtectVersion): -1 | 0 | 1 {
	for (const key of ['major', 'minor', 'patch'] as const) {
		if (a[key] !== b[key]) {
			return a[key] < b[key] ? -1 : 1;
		}
	}

	return 0;
}

export function isSupportedProtectVersion(value: unknown, minimum: string = PROTECT_MIN_VERSION): boolean {
	const version = parseProtectVersion(value);
	const min = parseProtectVersion(minimum);

	if (!version || !min) {
		return false;
	}

	return compareProtectVersions(version, min) >= 0;
}
