import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import {
	Dirent,
	closeSync,
	existsSync,
	fstatSync,
	openSync,
	readFileSync,
	readdirSync,
	realpathSync,
	statSync,
} from 'fs';
import { isAbsolute, join, relative, resolve, sep } from 'path';
import { parse as parseYaml } from 'yaml';

export type DefinitionSource = 'builtin' | 'user';

export interface DefinitionLoaderOptions<T> {
	builtinDirectory: string;
	userDirectory: string;
	userFilePrefix: string;
	overrideDirectory?: string | null;
	schema: object;
	collectionKey: string;
	idOf: (item: T) => string;
	validateItem?: (item: T) => string[];
	maxFileBytes?: number;
}

export interface DefinitionFileResult {
	source: DefinitionSource;
	path: string;
	loaded: number;
	errors: string[];
	warnings: string[];
}

export interface LoadedDefinition<T> {
	id: string;
	source: DefinitionSource;
	path: string;
	item: T;
	overridesBuiltin: boolean;
}

export interface DefinitionLoadResult<T> {
	definitions: LoadedDefinition<T>[];
	files: DefinitionFileResult[];
}

const DEFAULT_MAX_FILE_BYTES = 1_048_576;
const YAML_EXTENSION = /\.ya?ml$/i;

export class DefinitionLoader<T> {
	private readonly validateSchema: ValidateFunction;
	private readonly maxFileBytes: number;

	constructor(private readonly options: DefinitionLoaderOptions<T>) {
		this.validateSchema = new Ajv({ allErrors: true, strict: true }).compile(options.schema);
		this.maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
	}

	load(): DefinitionLoadResult<T> {
		const files: DefinitionFileResult[] = [];
		const builtin = this.loadSource('builtin', this.options.builtinDirectory, true, files, new Map());

		const overrideDirectory = this.options.overrideDirectory;
		const user = overrideDirectory
			? this.loadSource('user', overrideDirectory, true, files, builtin)
			: existsSync(this.options.userDirectory)
				? this.loadSource('user', this.options.userDirectory, false, files, builtin)
				: new Map<string, LoadedDefinition<T>>();

		const merged = new Map<string, LoadedDefinition<T>>(builtin);

		for (const [id, definition] of user) {
			merged.set(id, definition);
		}

		return {
			definitions: [...merged.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
			files,
		};
	}

	private loadSource(
		source: DefinitionSource,
		directory: string,
		recursive: boolean,
		files: DefinitionFileResult[],
		builtin: Map<string, LoadedDefinition<T>>,
	): Map<string, LoadedDefinition<T>> {
		const accepted = new Map<string, LoadedDefinition<T>>();

		let root: string;

		try {
			root = realpathSync(resolve(directory));
		} catch {
			files.push({ source, path: '.', loaded: 0, errors: ['directory not found'], warnings: [] });

			return accepted;
		}

		const paths = this.collectFiles(
			source,
			root,
			recursive,
			source === 'user' && !this.options.overrideDirectory,
			files,
		);

		for (const path of paths) {
			const result: DefinitionFileResult = { source, path, loaded: 0, errors: [], warnings: [] };

			files.push(result);

			const items = this.readFile(root, path, result);

			if (items === null) {
				continue;
			}

			for (const item of items) {
				const id = this.options.idOf(item);

				const itemErrors = this.options.validateItem?.(item) ?? [];

				if (itemErrors.length > 0) {
					result.errors.push(...itemErrors);

					continue;
				}

				if (accepted.has(id)) {
					result.errors.push(`duplicate definition id ${id} (first defined in ${accepted.get(id)?.path})`);

					continue;
				}

				const overridesBuiltin = source === 'user' && builtin.has(id);

				if (overridesBuiltin) {
					result.warnings.push(`overrides built-in definition ${id}`);
				}

				accepted.set(id, { id, source, path, item, overridesBuiltin });
				result.loaded++;
			}
		}

		return accepted;
	}

	private collectFiles(
		source: DefinitionSource,
		root: string,
		recursive: boolean,
		prefixed: boolean,
		files: DefinitionFileResult[],
	): string[] {
		const found: string[] = [];

		const walk = (directory: string): void => {
			let entries: Dirent[];

			try {
				entries = readdirSync(directory, { withFileTypes: true });
			} catch (error) {
				files.push({
					source,
					path: relative(root, directory) || '.',
					loaded: 0,
					errors: [`cannot read directory: ${errorMessage(error)}`],
					warnings: [],
				});

				return;
			}

			for (const entry of entries) {
				if (entry.isDirectory()) {
					if (recursive) {
						walk(join(directory, entry.name));
					}

					continue;
				}

				if (entry.isSymbolicLink() && recursive && isDirectoryLink(join(directory, entry.name))) {
					files.push({
						source,
						path: relative(root, join(directory, entry.name)),
						loaded: 0,
						errors: ['symbolic link to a directory is not followed'],
						warnings: [],
					});

					continue;
				}

				if (!entry.isFile() && !entry.isSymbolicLink()) {
					continue;
				}

				if (!YAML_EXTENSION.test(entry.name)) {
					continue;
				}

				if (prefixed && !entry.name.startsWith(this.options.userFilePrefix)) {
					continue;
				}

				found.push(relative(root, join(directory, entry.name)));
			}
		};

		walk(root);

		return found.sort();
	}

	/** Returns the file's items, or null when the file was rejected (errors recorded on the result). */
	private readFile(root: string, path: string, result: DefinitionFileResult): T[] | null {
		let real: string;

		try {
			real = realpathSync(join(root, path));
		} catch (error) {
			result.errors.push(`cannot read file: ${errorMessage(error)}`);

			return null;
		}

		if (!isInside(root, real)) {
			result.errors.push('outside the definitions directory');

			return null;
		}

		let text: string;

		try {
			if (!statSync(real).isFile()) {
				result.errors.push('not a regular file');

				return null;
			}

			// Open first and check the descriptor, so the size limit applies to what is actually read.
			const descriptor = openSync(real, 'r');

			try {
				const stat = fstatSync(descriptor);

				if (!stat.isFile()) {
					result.errors.push('not a regular file');

					return null;
				}

				if (stat.size > this.maxFileBytes) {
					result.errors.push(`file exceeds ${this.maxFileBytes} bytes`);

					return null;
				}

				text = readFileSync(descriptor, 'utf8');
			} finally {
				closeSync(descriptor);
			}
		} catch (error) {
			result.errors.push(`cannot read file: ${errorMessage(error)}`);

			return null;
		}

		let parsed: unknown;

		try {
			parsed = parseYaml(text, { maxAliasCount: 0, uniqueKeys: true });
		} catch (error) {
			result.errors.push(errorMessage(error));

			return null;
		}

		if (!this.validateSchema(parsed)) {
			result.errors.push(...formatSchemaErrors(this.validateSchema.errors));

			return null;
		}

		const items = (parsed as Record<string, unknown>)[this.options.collectionKey];

		if (!Array.isArray(items)) {
			result.errors.push(`/${this.options.collectionKey}: must be an array`);

			return null;
		}

		const ids = new Set<string>();
		const duplicates = new Set<string>();

		for (const item of items as T[]) {
			const id = this.options.idOf(item);

			if (ids.has(id)) {
				duplicates.add(id);
			}

			ids.add(id);
		}

		if (duplicates.size > 0) {
			result.errors.push(`duplicate definition id ${[...duplicates].sort().join(', ')} within the file`);

			return null;
		}

		return items as T[];
	}
}

function isInside(root: string, file: string): boolean {
	const fromRoot = relative(root, file);

	return fromRoot !== '' && fromRoot !== '..' && !fromRoot.startsWith('..' + sep) && !isAbsolute(fromRoot);
}

function isDirectoryLink(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}

function formatSchemaErrors(errors: ErrorObject[] | null | undefined): string[] {
	const formatted = new Set(
		(errors ?? []).map((error) => `${error.instancePath || '/'}: ${error.message ?? 'is invalid'}`),
	);

	return formatted.size > 0 ? [...formatted] : ['schema validation failed'];
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'unknown error';
}
