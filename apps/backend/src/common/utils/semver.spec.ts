import { readFileSync } from 'fs';
import { join } from 'path';

import { comparePrereleaseIdentifiers, compareSemver, getUpdateType } from './semver';

describe('compareSemver', () => {
	it('should order by major, minor and patch', () => {
		expect(compareSemver('1.0.0', '2.0.0')).toBe(-1);
		expect(compareSemver('2.0.0', '1.0.0')).toBe(1);
		expect(compareSemver('1.1.0', '1.0.0')).toBe(1);
		expect(compareSemver('1.0.1', '1.0.0')).toBe(1);
		expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
	});

	it('should ignore a leading v', () => {
		expect(compareSemver('v1.0.0', '1.0.0')).toBe(0);
		expect(compareSemver('v1.0.1', 'v1.0.0')).toBe(1);
	});

	it('should rank a pre-release below its release', () => {
		expect(compareSemver('1.0.0-beta.1', '1.0.0')).toBe(-1);
		expect(compareSemver('1.0.0', '1.0.0-beta.1')).toBe(1);
	});

	it('should order pre-releases of the same version', () => {
		expect(compareSemver('1.0.0-alpha.1', '1.0.0-beta.1')).toBe(-1);
		expect(compareSemver('1.0.0-beta.1', '1.0.0-beta.2')).toBe(-1);
		// Fewer identifiers rank lower, so 1.0.0-beta precedes 1.0.0-beta.1
		expect(compareSemver('1.0.0-beta', '1.0.0-beta.1')).toBe(-1);
		expect(compareSemver('1.0.0-beta.1', '1.0.0-beta.1')).toBe(0);
	});

	describe('build metadata', () => {
		// Semver §10: build metadata MUST be ignored when determining precedence. Splitting on
		// '-' without discarding it first reads "1.0.0+build-7" as a pre-release of 1.0.0, and
		// leaves "1.0.1+build" as the base so Number() yields NaN for the patch.
		it('should be ignored entirely', () => {
			expect(compareSemver('1.0.0+build-7', '1.0.0')).toBe(0);
			expect(compareSemver('1.0.0', '1.0.0+build-7')).toBe(0);
			expect(compareSemver('1.0.0+a', '1.0.0+b')).toBe(0);
		});

		it('should not swallow the version it is attached to', () => {
			expect(compareSemver('1.0.1+build-alpha', '1.0.0')).toBe(1);
			expect(compareSemver('1.0.0', '1.0.1+build-alpha')).toBe(-1);
		});

		it('should not disturb a real pre-release', () => {
			expect(compareSemver('1.0.0-beta.2+build', '1.0.0-beta.2')).toBe(0);
			expect(compareSemver('1.0.0-beta.2+build', '1.0.0-beta.3')).toBe(-1);
			expect(compareSemver('1.0.0-beta.2+build', '1.0.0')).toBe(-1);
		});
	});
});

describe('comparePrereleaseIdentifiers', () => {
	it('should rank numeric identifiers below alphanumeric ones', () => {
		expect(comparePrereleaseIdentifiers('1', 'alpha')).toBe(-1);
		expect(comparePrereleaseIdentifiers('alpha', '1')).toBe(1);
	});

	it('should compare numerically where both are numbers', () => {
		expect(comparePrereleaseIdentifiers('alpha.2', 'alpha.10')).toBe(-1);
	});

	it('should treat a shorter identifier list as lower', () => {
		expect(comparePrereleaseIdentifiers('alpha', 'alpha.1')).toBe(-1);
		expect(comparePrereleaseIdentifiers('alpha.1', 'alpha')).toBe(1);
	});
});

describe('getUpdateType', () => {
	it('should classify by the first differing component', () => {
		expect(getUpdateType('1.0.0', '2.0.0')).toBe('major');
		expect(getUpdateType('1.0.0', '1.1.0')).toBe('minor');
		expect(getUpdateType('1.0.0', '1.0.1')).toBe('patch');
	});

	it('should disregard pre-release and build metadata', () => {
		expect(getUpdateType('0.7.0-alpha.1', '1.0.0-beta.2')).toBe('major');
		expect(getUpdateType('1.0.0', '1.0.1+build-alpha')).toBe('patch');
		expect(getUpdateType('1.0.0', '2.0.0+build-alpha')).toBe('major');
	});
});

describe('shared copy in build/src/utils/version.ts', () => {
	/**
	 * The comparison logic is duplicated so the installer package can run without the backend
	 * installed. Both files say in a header comment that the other must be updated in step,
	 * which is a convention nothing enforces — this asserts it, since a silent divergence would
	 * mean the installer and the running app disagree about which version is newer.
	 */
	const extract = (source: string, name: string): string => {
		const start = source.indexOf(`function ${name}(`);

		expect(start).toBeGreaterThan(-1);

		// Walk braces from the function's opening brace to its match.
		const open = source.indexOf('{', start);
		let depth = 0;

		for (let i = open; i < source.length; i++) {
			if (source[i] === '{') depth++;
			if (source[i] === '}') depth--;
			if (depth === 0) {
				return source
					.slice(open, i + 1)
					.replace(/\s+/g, ' ')
					.trim();
			}
		}

		throw new Error(`Unbalanced braces while extracting ${name}`);
	};

	it.each(['compareSemver', 'comparePrereleaseIdentifiers'])('%s is identical in both copies', (name) => {
		const backendRoot = join(__dirname, '..', '..', '..');
		const backend = readFileSync(join(backendRoot, 'src/common/utils/semver.ts'), 'utf-8');
		const build = readFileSync(join(backendRoot, '..', '..', 'build/src/utils/version.ts'), 'utf-8');

		expect(extract(build, name)).toBe(extract(backend, name));
	});
});
