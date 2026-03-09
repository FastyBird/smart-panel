/**
 * Compare two semver version strings.
 * Returns -1 if a < b, 0 if a === b, 1 if a > b.
 *
 * NOTE: The core comparison logic is shared with build/src/utils/version.ts.
 * This file additionally exports getUpdateType and comparePrereleaseIdentifiers
 * which are only needed in the backend. If you change the comparison logic here,
 * update the build copy as well.
 */
export function compareSemver(a: string, b: string): number {
	const parseVersion = (v: string) => {
		const cleaned = v.replace(/^v/, '');
		const [base, ...prereleaseParts] = cleaned.split('-');
		const parts = base.split('.').map(Number);
		const prerelease = prereleaseParts.length > 0 ? prereleaseParts.join('-') : null;

		return { parts, prerelease };
	};

	const aParsed = parseVersion(a);
	const bParsed = parseVersion(b);

	for (let i = 0; i < 3; i++) {
		const av = aParsed.parts[i] || 0;
		const bv = bParsed.parts[i] || 0;

		if (av < bv) return -1;
		if (av > bv) return 1;
	}

	// Pre-release version has lower precedence than the release version
	if (aParsed.prerelease && !bParsed.prerelease) return -1;
	if (!aParsed.prerelease && bParsed.prerelease) return 1;

	if (aParsed.prerelease && bParsed.prerelease) {
		return comparePrereleaseIdentifiers(aParsed.prerelease, bParsed.prerelease);
	}

	return 0;
}

export function comparePrereleaseIdentifiers(current: string, latest: string): number {
	const currentParts = current.split('.');
	const latestParts = latest.split('.');

	const maxLength = Math.max(currentParts.length, latestParts.length);

	for (let i = 0; i < maxLength; i++) {
		// Fewer identifiers = lower precedence (per semver spec)
		if (i >= currentParts.length) return -1;
		if (i >= latestParts.length) return 1;

		const cPart = currentParts[i];
		const lPart = latestParts[i];

		const cNum = Number(cPart);
		const lNum = Number(lPart);

		const cIsNum = !isNaN(cNum);
		const lIsNum = !isNaN(lNum);

		// Numeric identifiers have lower precedence than string identifiers
		if (cIsNum && !lIsNum) return -1;
		if (!cIsNum && lIsNum) return 1;

		if (cIsNum && lIsNum) {
			if (cNum < lNum) return -1;
			if (cNum > lNum) return 1;
		} else {
			// Both are strings - compare lexically
			if (cPart < lPart) return -1;
			if (cPart > lPart) return 1;
		}
	}

	return 0;
}

export function getUpdateType(current: string, latest: string): 'patch' | 'minor' | 'major' {
	const cleanVersion = (v: string) => v.replace(/^v/, '').split('-')[0];

	const currentParts = cleanVersion(current).split('.').map(Number);
	const latestParts = cleanVersion(latest).split('.').map(Number);

	if ((latestParts[0] || 0) !== (currentParts[0] || 0)) return 'major';
	if ((latestParts[1] || 0) !== (currentParts[1] || 0)) return 'minor';

	return 'patch';
}
