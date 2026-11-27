import { readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { preProcessFile } from 'typescript';

it('keeps the virtual devices implementation independent of other device plugins', () => {
	const dependencies: string[] = [];
	const plugins = dirname(__dirname);
	for (const name of readdirSync(__dirname, { recursive: true, encoding: 'utf8' })) {
		if (!name.endsWith('.ts') || name.endsWith('.spec.ts')) continue;
		const file = resolve(__dirname, name);
		for (const { fileName } of preProcessFile(readFileSync(file, 'utf8'), true, true).importedFiles) {
			const target = fileName.startsWith('src/')
				? resolve(plugins, '../..', fileName)
				: resolve(dirname(file), fileName);
			const path = relative(plugins, target);
			if (fileName.startsWith('.') || fileName.startsWith('src/')) {
				if (!path.startsWith('..') && path.split(sep)[0] !== 'devices-virtual')
					dependencies.push(`${name} imports ${fileName}`);
			}
		}
	}
	expect(dependencies).toEqual([]);
});
