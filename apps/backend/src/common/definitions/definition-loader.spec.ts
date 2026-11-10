import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

import { DefinitionLoader, DefinitionLoaderOptions } from './definition-loader';

interface Item {
	id: string;
	label?: string;
}

const schema = {
	type: 'object',
	required: ['version', 'items'],
	additionalProperties: false,
	properties: {
		version: { const: '1.0' },
		items: {
			type: 'array',
			items: {
				type: 'object',
				required: ['id'],
				additionalProperties: false,
				properties: { id: { type: 'string' }, label: { type: 'string' } },
			},
		},
	},
};

describe('DefinitionLoader', () => {
	let root: string;
	let builtinDir: string;
	let userDir: string;

	const write = (path: string, content: string): void => {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content);
	};

	const file = (...ids: string[]): string => `version: '1.0'\nitems:\n${ids.map((id) => `  - id: ${id}\n`).join('')}`;

	const loader = (overrides: Partial<DefinitionLoaderOptions<Item>> = {}): DefinitionLoader<Item> =>
		new DefinitionLoader<Item>({
			builtinDirectory: builtinDir,
			userDirectory: userDir,
			userFilePrefix: 'plugin.test.',
			schema,
			collectionKey: 'items',
			idOf: (item) => item.id,
			...overrides,
		});

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), 'definitions-'));
		builtinDir = join(root, 'builtin');
		userDir = join(root, 'user');
		mkdirSync(builtinDir);
		mkdirSync(userDir);
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it('loads built-in files recursively and user files with the prefix only', () => {
		write(join(builtinDir, 'a.yaml'), file('a'));
		write(join(builtinDir, 'nested', 'b.yml'), file('b'));
		write(join(userDir, 'plugin.test.c.yaml'), file('c'));
		write(join(userDir, 'other.d.yaml'), file('d'));

		const result = loader().load();

		expect(result.definitions.map((d) => d.id)).toEqual(['a', 'b', 'c']);
		expect(result.files.map((f) => `${f.source}:${f.path}`)).toEqual([
			'builtin:a.yaml',
			`builtin:${join('nested', 'b.yml')}`,
			'user:plugin.test.c.yaml',
		]);
	});

	it('lets a user definition override a built-in with the same id', () => {
		write(join(builtinDir, 'a.yaml'), file('a'));
		write(join(userDir, 'plugin.test.a.yaml'), file('a'));

		const result = loader().load();

		expect(result.definitions).toHaveLength(1);
		expect(result.definitions[0]).toMatchObject({ id: 'a', source: 'user', overridesBuiltin: true });
		expect(result.files[1].warnings).toContain('overrides built-in definition a');
	});

	it('reports a schema error and keeps loading other files', () => {
		write(join(builtinDir, 'bad.yaml'), "version: '1.0'\nitems:\n  - label: x\n");
		write(join(builtinDir, 'good.yaml'), file('good'));

		const result = loader().load();

		expect(result.definitions.map((d) => d.id)).toEqual(['good']);
		expect(result.files[0].errors).toContain("/items/0: must have required property 'id'");
	});

	it('rejects unknown keys', () => {
		write(join(builtinDir, 'a.yaml'), "version: '1.0'\nitems:\n  - id: a\n    formula: x\n");

		const result = loader().load();

		expect(result.definitions).toEqual([]);
		expect(result.files[0].errors.join()).toContain('must NOT have additional properties');
	});

	it('reports YAML syntax errors per file', () => {
		write(join(builtinDir, 'a.yaml'), 'items: [unclosed\n');
		write(join(builtinDir, 'b.yaml'), file('b'));

		const result = loader().load();

		expect(result.files[0].errors).toHaveLength(1);
		expect(result.definitions.map((d) => d.id)).toEqual(['b']);
	});

	it('refuses files larger than the limit', () => {
		write(join(builtinDir, 'a.yaml'), file('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'));

		const result = loader({ maxFileBytes: 64 }).load();

		expect(result.definitions).toEqual([]);
		expect(result.files[0].errors).toEqual(['file exceeds 64 bytes']);
	});

	it('refuses alias expansion', () => {
		write(join(builtinDir, 'a.yaml'), "version: '1.0'\nitems:\n  - id: a\n    label: &x l\n  - id: b\n    label: *x\n");

		const result = loader().load();

		expect(result.definitions).toEqual([]);
		expect(result.files[0].errors).toHaveLength(1);
		expect(result.files[0].errors[0]).toMatch(/alias/i);
		expect(result.files[0].loaded).toBe(0);
	});

	it('reports a directory that cannot be read', () => {
		const notADirectory = join(root, 'file.txt');

		write(notADirectory, 'x');

		const result = loader({ builtinDirectory: notADirectory }).load();

		expect(result.definitions).toEqual([]);
		expect(result.files).toHaveLength(1);
		expect(result.files[0]).toMatchObject({ source: 'builtin', path: '.', loaded: 0 });
		expect(result.files[0].errors[0]).toMatch(/^cannot read directory: /);
	});

	it('refuses a symlink that escapes the directory', () => {
		const outside = join(root, 'outside.yaml');

		write(outside, file('evil'));
		symlinkSync(outside, join(userDir, 'plugin.test.link.yaml'));

		const result = loader().load();

		expect(result.definitions).toEqual([]);
		expect(result.files[0].errors).toEqual(['outside the definitions directory']);
	});

	it('reports a symlink to a directory instead of reading it', () => {
		const target = join(userDir, 'inner');

		mkdirSync(target);
		symlinkSync(target, join(userDir, 'plugin.test.dir.yaml'));

		const result = loader().load();

		expect(result.definitions).toEqual([]);
		expect(result.files[0].errors).toEqual(['not a regular file']);
	});

	it('reports a symlink to a FIFO instead of blocking on it', () => {
		const fifo = join(userDir, 'pipe');

		try {
			execFileSync('mkfifo', [fifo]);
		} catch {
			return;
		}

		symlinkSync(fifo, join(userDir, 'plugin.test.fifo.yaml'));

		const result = loader().load();

		expect(result.definitions).toEqual([]);
		expect(result.files[0].errors).toEqual(['not a regular file']);
	});

	it('reports a symlinked subdirectory in recursive mode', () => {
		const target = join(root, 'elsewhere');

		write(join(target, 'x.yaml'), file('x'));
		symlinkSync(target, join(builtinDir, 'linked'));

		const result = loader().load();

		expect(result.definitions).toEqual([]);
		expect(result.files).toEqual([
			{
				source: 'builtin',
				path: 'linked',
				loaded: 0,
				errors: ['symbolic link to a directory is not followed'],
				warnings: [],
			},
		]);
	});

	it('loads a file whose name starts with two dots', () => {
		write(join(builtinDir, '..foo.yaml'), file('dots'));

		const result = loader().load();

		expect(result.definitions.map((definition) => definition.id)).toEqual(['dots']);
		expect(result.files[0].errors).toEqual([]);
	});

	it('rejects a file with a duplicate id', () => {
		write(join(builtinDir, 'a.yaml'), file('a', 'a', 'b'));

		const result = loader().load();

		expect(result.definitions).toEqual([]);
		expect(result.files[0].errors).toHaveLength(1);
	});

	it('keeps the first of two files defining the same id', () => {
		write(join(builtinDir, 'a.yaml'), "version: '1.0'\nitems:\n  - id: x\n    label: first\n");
		write(join(builtinDir, 'b.yaml'), "version: '1.0'\nitems:\n  - id: x\n    label: second\n");

		const result = loader().load();

		expect(result.definitions).toHaveLength(1);
		expect(result.definitions[0].item.label).toBe('first');
		expect(result.files[1].errors).toHaveLength(1);
		expect(result.files[1].loaded).toBe(0);
	});

	it('skips items failing validateItem and reports their messages', () => {
		write(join(builtinDir, 'a.yaml'), file('good', 'bad'));

		const result = loader({ validateItem: (i) => (i.id === 'bad' ? ['bad is bad'] : []) }).load();

		expect(result.definitions.map((d) => d.id)).toEqual(['good']);
		expect(result.files[0].errors).toEqual(['bad is bad']);
		expect(result.files[0].loaded).toBe(1);
	});

	it('scans every yaml file under the override directory instead of the user directory', () => {
		const override = join(root, 'override');

		write(join(override, 'any.yaml'), file('o1'));
		write(join(override, 'deep', 'x.yml'), file('o2'));
		write(join(userDir, 'plugin.test.u.yaml'), file('u'));

		const result = loader({ overrideDirectory: override }).load();

		expect(result.definitions.map((d) => d.id)).toEqual(['o1', 'o2']);
	});

	it('reports a configured override directory that does not exist', () => {
		const result = loader({ overrideDirectory: join(root, 'missing') }).load();

		expect(result.files).toEqual([
			{ source: 'user', path: '.', loaded: 0, errors: ['directory not found'], warnings: [] },
		]);
	});

	it('reports a missing built-in directory', () => {
		rmSync(builtinDir, { recursive: true });

		const result = loader().load();

		expect(result.files).toEqual([
			{ source: 'builtin', path: '.', loaded: 0, errors: ['directory not found'], warnings: [] },
		]);
	});

	it('ignores a missing user directory', () => {
		rmSync(userDir, { recursive: true });

		expect(loader().load().files).toEqual([]);
	});
});
