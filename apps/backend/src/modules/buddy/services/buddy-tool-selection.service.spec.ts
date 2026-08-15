import { z } from 'zod';

import {
	ToolAccessKind,
	ToolAudience,
	ToolDefinition,
	createToolDefinition,
} from '../../tools/platforms/tool-provider.platform';

import { BuddyToolSelectionService } from './buddy-tool-selection.service';
import { QUERY_HOME_STATE_TOOL_NAME, SEARCH_HOME_TOOL_NAME } from './home-context-tool-provider.service';

const names = {
	control: 'control_device',
	scene: 'run_scene',
	spaceLighting: 'set_space_lighting',
};

function tool(name: string, access: ToolAccessKind): ToolDefinition {
	return createToolDefinition({
		name,
		description: `${name} test tool`,
		audiences: [ToolAudience.BUDDY],
		access,
		inputSchema: z.object({}),
		outputSchema: z.object({ ok: z.boolean() }),
	});
}

describe('BuddyToolSelectionService', () => {
	const service = new BuddyToolSelectionService();
	const definitions = [
		tool(SEARCH_HOME_TOOL_NAME, ToolAccessKind.READ),
		tool(QUERY_HOME_STATE_TOOL_NAME, ToolAccessKind.READ),
		tool(names.control, ToolAccessKind.WRITE),
		tool(names.scene, ToolAccessKind.TRIGGER),
		tool(names.spaceLighting, ToolAccessKind.TRIGGER),
	];
	const selectNames = (message: string, available = definitions): string[] =>
		service.select(message, available).map((definition) => definition.name);

	it('omits all built-in schemas for general conversation', () => {
		expect(selectNames('Hello! Tell me a joke.')).toEqual([]);
	});

	it.each([
		'What is the bedroom temperature?',
		'Are any windows open?',
		'Find Aurora and show its current status.',
		'Jaká je teplota a vlhkost v ložnici?',
	])('selects only the dependent read pair for a state or search request: %s', (message) => {
		expect(selectNames(message)).toEqual([SEARCH_HOME_TOOL_NAME, QUERY_HOME_STATE_TOOL_NAME]);
	});

	it('selects scene execution without unrelated device or lighting actions', () => {
		expect(selectNames('Run the evening scene.')).toEqual([names.scene]);
	});

	it('selects individual device control for a specific lamp', () => {
		expect(selectNames('Dim the desk lamp.')).toEqual([names.control]);
	});

	it('keeps both lighting action shapes when the request names a room', () => {
		expect(selectNames('Turn off the kitchen lights.')).toEqual([names.control, names.spaceLighting]);
	});

	it('keeps all action shapes for an ambiguous follow-up reference', () => {
		expect(selectNames('Turn it off.')).toEqual([names.control, names.scene, names.spaceLighting]);
	});

	it('combines read and relevant action tools for a compound request', () => {
		expect(selectNames('Turn off the kitchen lights and tell me whether any window is open.')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
			names.control,
			names.spaceLighting,
		]);
	});

	it('falls back to every built-in tool for ambiguous home-related wording', () => {
		expect(selectNames('Help me with my smart home.')).toEqual(definitions.map((definition) => definition.name));
	});

	it('preserves unknown extension tools and original registry order', () => {
		const extension = tool('extension_specific_tool', ToolAccessKind.READ);
		const interleaved = [definitions[2], extension, definitions[0], definitions[4], definitions[1], definitions[3]];

		expect(selectNames('What is the temperature?', interleaved)).toEqual([
			'extension_specific_tool',
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
	});
});
