import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

/**
 * `nest build` only copies non-TS files listed under `compilerOptions.assets`.
 * A glob that no longer matches anything is silent — the build succeeds and the
 * files are simply missing from `dist`, so the failure only surfaces at runtime
 * as whatever consumes them degrading. That is how the spaces intent catalog
 * ended up loading zero intents in every built artifact after its YAML moved.
 */
describe('nest-cli asset globs', () => {
	const backendRoot = resolve(__dirname, '..');
	const sourceRoot = join(backendRoot, 'src');

	const nestCli = JSON.parse(readFileSync(join(backendRoot, 'nest-cli.json'), 'utf8')) as {
		compilerOptions?: { assets?: ({ include?: string } | string)[] };
	};

	const includes = (nestCli.compilerOptions?.assets ?? [])
		.map((asset) => (typeof asset === 'string' ? asset : asset.include))
		.filter((include): include is string => typeof include === 'string');

	const collectFiles = (dir: string): string[] => {
		if (!existsSync(dir)) {
			return [];
		}

		return readdirSync(dir).flatMap((entry) => {
			const full = join(dir, entry);

			return statSync(full).isDirectory() ? collectFiles(full) : [full];
		});
	};

	const matches = (include: string): string[] => {
		// Every glob in this project is `<dir>/**/*.<ext>`; anything else is
		// treated as a literal path so an unsupported shape can't pass silently.
		const [base, pattern] = include.split('/**/');

		if (pattern === undefined) {
			return existsSync(join(sourceRoot, include)) ? [include] : [];
		}

		const extension = pattern.replace(/^\*/, '');

		return collectFiles(join(sourceRoot, base)).filter((file) => file.endsWith(extension));
	};

	it('declares at least one asset glob', () => {
		expect(includes.length).toBeGreaterThan(0);
	});

	it.each(includes)('resolves %s to at least one file under src', (include) => {
		expect(matches(include)).not.toHaveLength(0);
	});
});
