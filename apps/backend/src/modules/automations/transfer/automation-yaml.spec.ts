import { parse } from 'yaml';

import { AUTOMATION_IMPORT_MAX_DEPTH, AUTOMATION_IMPORT_MAX_LENGTH } from '../automations.constants';

import {
	AutomationExportSource,
	automationExportFileName,
	parseAutomationYaml,
	serializeAutomationYaml,
} from './automation-yaml';

const SOURCE: AutomationExportSource = {
	name: 'Hallway motion light',
	description: 'Turns the hallway light on at night',
	icon: 'mdi:motion-sensor',
	mode: 'parallel',
	spaceId: '550e8400-e29b-41d4-a716-446655440000',
	graph: {
		nodes: [
			{
				id: 'n1',
				type: 'device.property.changed',
				position: { x: 40, y: -80.5 },
				config: {
					device_id: 'd1',
					camelCaseKey: true,
					nested: { list: [1, 'two', { three: 3 }], text: 'a: b # not a comment' },
				},
			},
			{ id: 'n2', type: 'scene.run', position: { x: 300, y: 0 }, config: { scene_id: 's1' } },
		],
		edges: [{ id: 'e1', source: 'n1', source_port: 'out', target: 'n2', target_port: 'in' }],
	},
};

const refused = (text: string): { field: string; reason: string }[] => {
	const result = parseAutomationYaml(text);

	expect(result.data).toBeNull();

	return result.problems;
};

describe('automation YAML', () => {
	describe('export', () => {
		it('writes a versioned automation document without anything of the installation but its references', () => {
			const yaml = serializeAutomationYaml(SOURCE);

			expect(yaml.startsWith('# Smart Panel automation\n')).toBe(true);
			expect(parse(yaml)).toEqual({
				version: 1,
				kind: 'automation',
				name: 'Hallway motion light',
				description: 'Turns the hallway light on at night',
				icon: 'mdi:motion-sensor',
				mode: 'parallel',
				space_id: '550e8400-e29b-41d4-a716-446655440000',
				graph: { nodes: SOURCE.graph.nodes, edges: SOURCE.graph.edges },
			});
		});

		it('leaves out the description, the icon and the space when there are none', () => {
			const document = parse(
				serializeAutomationYaml({ ...SOURCE, description: null, icon: '', spaceId: null }),
			) as Record<string, unknown>;

			expect(Object.keys(document)).toEqual(['version', 'kind', 'name', 'mode', 'graph']);
		});

		it('writes a value used twice out twice, never as an alias', () => {
			const shared = { device_id: 'd1' };

			const yaml = serializeAutomationYaml({
				...SOURCE,
				graph: {
					nodes: [
						{ id: 'a', type: 't', position: { x: 0, y: 0 }, config: shared },
						{ id: 'b', type: 't', position: { x: 0, y: 0 }, config: shared },
					],
					edges: [],
				},
			});

			expect(yaml).not.toContain('&');
			expect(parseAutomationYaml(yaml).problems).toEqual([]);
		});

		it.each([
			['Hallway motion light', 'hallway-motion-light.yaml'],
			['  Světlo v předsíni!  ', 'svetlo-v-predsini.yaml'],
			['Über / Ärger', 'uber-arger.yaml'],
			['???', 'automation.yaml'],
			['a'.repeat(100), `${'a'.repeat(64)}.yaml`],
		])('names the file of %j %j', (name, file) => {
			expect(automationExportFileName(name)).toBe(file);
		});
	});

	describe('import', () => {
		it('reads an export back as the fields of a create request and a graph document', () => {
			const result = parseAutomationYaml(serializeAutomationYaml(SOURCE));

			expect(result.problems).toEqual([]);
			expect(result.data).toEqual({
				name: SOURCE.name,
				description: SOURCE.description,
				icon: SOURCE.icon,
				mode: SOURCE.mode,
				space_id: SOURCE.spaceId,
				graph: { version: 1, nodes: SOURCE.graph.nodes, edges: SOURCE.graph.edges },
			});
		});

		it('reads a hand-written file: a node without a configuration has an empty one, a graph may be left out', () => {
			expect(
				parseAutomationYaml(
					'version: 1\nkind: automation\nname: Hand\ngraph:\n  nodes:\n    - { id: n1, type: t, position: { x: 0, y: 0 } }\n',
				).data?.graph.nodes,
			).toEqual([{ id: 'n1', type: 't', position: { x: 0, y: 0 }, config: {} }]);

			expect(parseAutomationYaml('version: 1\nkind: automation\nname: Empty\n').data).toEqual({
				name: 'Empty',
				graph: { version: 1, nodes: [], edges: [] },
			});
		});

		it('refuses a file that is empty or larger than the limit', () => {
			expect(refused('  \n')).toEqual([{ field: 'yaml', reason: 'The file is empty.' }]);
			expect(refused(`name: "${'x'.repeat(AUTOMATION_IMPORT_MAX_LENGTH)}"`)).toEqual([
				{ field: 'yaml', reason: 'The file is larger than 256 KB.' },
			]);
		});

		it.each([
			['not valid YAML', 'version: 1\nname: [unclosed\n', /not valid YAML \(.+\) at line \d+, column \d+\.$/],
			['a duplicate key', 'version: 1\nversion: 1\n', /DUPLICATE_KEY/],
			['a second document', 'version: 1\n---\nversion: 1\n', /MULTIPLE_DOCS/],
			['a language tag', 'version: 1\nname: !!js/function "return 1"\n', /TAG_RESOLVE_FAILED/],
			['a custom tag', 'version: 1\nname: !custom x\n', /TAG_RESOLVE_FAILED/],
			['an alias', 'version: 1\nkind: automation\nname: &n x\ndescription: *n\n', /^Aliases are not allowed\.$/],
		])('refuses %s', (_, text, reason) => {
			const problems = refused(text);

			expect(problems).toHaveLength(1);
			expect(problems[0].field).toBe('yaml');
			expect(problems[0].reason).toMatch(reason);
		});

		it('refuses an alias bomb without expanding it', () => {
			const lines = ['a0: &a0 [x, x, x, x, x, x, x, x, x, x]'];

			for (let level = 1; level < 9; level++) {
				lines.push(`a${level}: &a${level} [${Array.from({ length: 10 }, () => `*a${level - 1}`).join(', ')}]`);
			}

			expect(refused(lines.join('\n'))).toEqual([{ field: 'yaml', reason: 'Aliases are not allowed.' }]);
		});

		it('refuses values nested deeper than the limit', () => {
			const deep = `${'['.repeat(AUTOMATION_IMPORT_MAX_DEPTH + 1)}${']'.repeat(AUTOMATION_IMPORT_MAX_DEPTH + 1)}`;

			expect(refused(`version: 1\nkind: automation\nname: Deep\ndescription: ${deep}\n`)).toEqual([
				{ field: 'yaml', reason: `Values may not be nested more than ${AUTOMATION_IMPORT_MAX_DEPTH} levels deep.` },
			]);
		});

		it.each([['.nan'], ['.inf'], ['-.inf'], ['.NaN']])('refuses %s, which the stored JSON can not keep', (number) => {
			expect(
				refused(
					`version: 1\nkind: automation\nname: X\ngraph:\n  nodes:\n    - { id: a, type: t, position: { x: 0, y: 0 }, config: { level: [1, ${number}] } }\n`,
				),
			).toEqual([
				{
					field: 'graph.nodes.0.config.level.1',
					reason:
						'Only finite numbers, texts, yes/no values, null, lists and mappings can be imported; .nan and .inf can not.',
				},
			]);
		});

		it('refuses a document that is not one automation of a known version', () => {
			expect(refused('- a\n- b\n')).toEqual([{ field: 'yaml', reason: 'The file must hold one automation document.' }]);
			expect(refused('version: 2\nkind: scene\nname: X\nenabled: true\nid: abc\n')).toEqual([
				{ field: 'kind', reason: 'The document must be of kind "automation".' },
				{ field: 'version', reason: 'The document version must be 1; files of other versions can not be imported.' },
				{ field: 'enabled', reason: 'The document may not hold this key.' },
				{ field: 'id', reason: 'The document may not hold this key.' },
			]);
		});

		it('refuses a graph that is not a mapping of node and edge lists', () => {
			expect(refused('version: 1\nkind: automation\nname: X\ngraph: [1]\n')).toEqual([
				{ field: 'graph', reason: 'The graph must be a mapping with nodes and edges.' },
			]);
			expect(refused('version: 1\nkind: automation\nname: X\ngraph:\n  nodes: {}\n  edges: 1\n  version: 1\n')).toEqual(
				[
					{ field: 'graph.version', reason: 'The graph may not hold this key.' },
					{ field: 'graph.nodes', reason: 'The nodes of the graph must be a list.' },
					{ field: 'graph.edges', reason: 'The edges of the graph must be a list.' },
				],
			);
		});
	});
});
