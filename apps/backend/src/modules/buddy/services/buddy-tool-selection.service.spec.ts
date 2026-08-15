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
		expect(selectNames('How are you?')).toEqual([]);
		expect(selectNames('Write me a poem.')).toEqual([]);
	});

	it.each([
		'What is the bedroom temperature?',
		'Are any windows open?',
		'Fetch the hallway sensor reading.',
		'Get the hallway sensor reading.',
		'Report the hallway sensor reading.',
		'Find Aurora and show its current status.',
		'Which lights can I dim?',
		'What lights am I able to dim?',
		'Can you show which windows I can open?',
		'Jaká je teplota a vlhkost v ložnici?',
	])('selects only the dependent read pair for a state or search request: %s', (message) => {
		expect(selectNames(message)).toEqual([SEARCH_HOME_TOOL_NAME, QUERY_HOME_STATE_TOOL_NAME]);
	});

	it('selects scene execution without unrelated device or lighting actions', () => {
		expect(selectNames('Run the evening scene.')).toEqual([SEARCH_HOME_TOOL_NAME, names.scene]);
	});

	it('retains scene execution when an unrestricted scene name resembles a device', () => {
		expect(selectNames('Run Window Watch.')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			names.control,
			names.scene,
			names.spaceLighting,
		]);
	});

	it('selects individual device control for a specific lamp', () => {
		expect(selectNames('Dim the desk lamp.')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
			names.control,
		]);
	});

	it('retains live reads for relative adjustments', () => {
		expect(selectNames('Make the bedroom warmer')).toEqual(definitions.map((definition) => definition.name));
		expect(selectNames('Make the bedroom twice as bright')).toEqual(definitions.map((definition) => definition.name));
		expect(selectNames('Make the bedroom three times as bright')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Make the bedroom two degrees colder')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Make the kitchen light 10% higher')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
			names.control,
			names.spaceLighting,
		]);
		expect(selectNames('Turn the bedroom light up a bit')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
			names.control,
			names.spaceLighting,
		]);
	});

	it('uses action verbs without allowing unrestricted target names to exclude schemas', () => {
		expect(selectNames('Activate Window Watch.')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			names.control,
			names.scene,
			names.spaceLighting,
		]);
		expect(selectNames('Turn off Bedtime Scene.')).toEqual([SEARCH_HOME_TOOL_NAME, names.control, names.scene]);
	});

	it.each(['Increase the bedroom temperature.', 'Sniž teplotu.'])(
		'preserves device actions for adjustment wording: %s',
		(message) => {
			expect(selectNames(message)).toContain(names.control);
		},
	);

	it('falls back conservatively for unrecognized imperative-looking state wording', () => {
		expect(selectNames('Boost the bedroom temperature.')).toEqual(definitions.map((definition) => definition.name));
	});

	it('falls back conservatively for a question-form command with an unknown verb', () => {
		expect(selectNames('Would you execute Evening scene?')).toEqual(definitions.map((definition) => definition.name));
	});

	it('keeps both lighting action shapes when the request names a room', () => {
		expect(selectNames('Turn off the kitchen lights.')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			names.control,
			names.spaceLighting,
		]);
	});

	it('retains reads for grounded-state filters attached to actions', () => {
		expect(selectNames('Turn off the kitchen lights that are on.')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
			names.control,
			names.spaceLighting,
		]);
	});

	it('keeps all action shapes for an ambiguous follow-up reference', () => {
		expect(selectNames('Turn it off.')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			names.control,
			names.scene,
			names.spaceLighting,
		]);
	});

	it('combines read and relevant action tools for a compound request', () => {
		expect(selectNames('Turn off the kitchen lights and tell me whether any window is open.')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
			names.control,
			names.spaceLighting,
		]);
		expect(selectNames('Run Bedtime and tell me whether the window is open.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Run Bedtime and read the hallway sensor.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Read the hallway sensor, then close the blinds')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Run Bedtime and verify that the hallway sensor is triggered.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Run Bedtime, check whether the hallway sensor is triggered.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Run Bedtime and confirm that the hallway sensor is triggered.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Run Bedtime and make sure the hallway sensor is triggered.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Run Bedtime, report whether the hallway sensor is triggered.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Run Bedtime and determine whether the hallway sensor is triggered.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Run Bedtime and see whether the hallway sensor is triggered.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Run Bedtime and get the hallway sensor reading.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Run Bedtime and fetch the hallway sensor reading.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Run Bedtime and give me the hallway sensor reading.')).toEqual(
			definitions.map((definition) => definition.name),
		);
	});

	it('recognizes wh-complement state requests', () => {
		expect(selectNames('Could you tell me what the thermostat is set to?')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
		expect(selectNames('Please check whether the window is open?')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
	});

	it('retains every action schema for multiple commands with an arbitrary target name', () => {
		expect(selectNames('Close the blinds and run Bedtime.')).toEqual(definitions.map((definition) => definition.name));
		expect(selectNames('Zavři žaluzie a spusť Večer.')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			names.control,
			names.scene,
			names.spaceLighting,
		]);
		expect(selectNames('Run Bedtime and also close the blinds.')).toEqual(
			definitions.map((definition) => definition.name),
		);
	});

	it.each(['Are any windows open? If so, close them.', 'Are all doors closed, and open them if not.'])(
		'preserves a command that follows a state-first clause: %s',
		(message) => {
			expect(selectNames(message)).toEqual(definitions.map((definition) => definition.name));
		},
	);

	it('falls back conservatively for an unrecognized adjustment after a state question', () => {
		expect(selectNames('What is the bedroom temperature? Make it warmer.')).toEqual(
			definitions.map((definition) => definition.name),
		);
	});

	it('recognizes a punctuation-delimited command after a state-first clause', () => {
		expect(selectNames('Are any windows open, close them if so.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Jaká je teplota a nastav termostat na 20.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Is the thermostat set to 20, turn it down.')).toEqual(
			definitions.map((definition) => definition.name),
		);
	});

	it('retains reads for a grounded state-first clause without a question mark', () => {
		expect(selectNames('Is Aurora locked, unlock it.')).toEqual(definitions.map((definition) => definition.name));
	});

	it('does not use condition targets to narrow an ambiguous command target', () => {
		expect(selectNames('If the window is open, run Bedtime.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Run Bedtime if the window is open.')).toEqual(definitions.map((definition) => definition.name));
		expect(selectNames('Run Bedtime so long as Aurora is on.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Close the blinds while you run Evening.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Close the blinds before you launch Evening.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Run Bedtime assuming the hallway sensor is triggered.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Run Bedtime given that the hallway sensor is triggered.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('If the window is open run Bedtime')).toEqual(definitions.map((definition) => definition.name));
		expect(selectNames('Spusť Večer pokud je okno otevřené.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Když je okno otevřené, spusť Večer.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Execute Evening if the window is open.')).toEqual(
			definitions.map((definition) => definition.name),
		);
	});

	it('retains live reads needed to evaluate conditional actions', () => {
		expect(selectNames('If Aurora is on, run Bedtime.')).toEqual(definitions.map((definition) => definition.name));
		expect(selectNames('If the hallway sensor is triggered, run Bedtime.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Close the blinds unless Aurora is triggered.')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
			names.control,
		]);
		expect(selectNames('Close the blinds provided that Aurora is triggered.')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
			names.control,
		]);
		expect(selectNames('Once Aurora is triggered, run Bedtime.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Close the blinds until Aurora is triggered.')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
			names.control,
		]);
		expect(selectNames('Close the blinds while the hallway sensor is triggered.')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
			names.control,
		]);
	});

	it.each([
		'How does a thermostat work?',
		'How does a temperature sensor work?',
		'Explain how smart-home lighting works.',
		'Explain how to adjust a thermostat.',
		'Explain how to turn off the kitchen light.',
		'How do I turn off the kitchen light?',
		'How can I adjust a thermostat?',
		'Tell me how to turn off the kitchen light.',
		'Show me how to turn off the kitchen light.',
	])('keeps generic smart-home explanations tool-free: %s', (message) => {
		expect(selectNames(message)).toEqual([]);
	});

	it('retains live reads for explain-whether state questions', () => {
		expect(selectNames('Explain whether the kitchen light is on.')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
		expect(selectNames('Explain why the kitchen light is off.')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
		expect(selectNames('Explain why the hallway sensor is triggered.')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
		expect(selectNames('Explain what the kitchen temperature is?')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
		expect(selectNames('Explain how the kitchen thermostat is doing right now.')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
		expect(selectNames('Explain how warm the bedroom is.')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
	});

	it('treats tell-whether wording as a read-only state question', () => {
		expect(selectNames('Tell me whether the window is open.')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
		expect(selectNames('Can you tell me whether the window is open?')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
		expect(selectNames('Can you let me know whether the window is open?')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
		expect(selectNames('Can you report whether the window is open?')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
		expect(selectNames('Could you read whether the window is open?')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
		expect(selectNames('Could you get whether the window is open?')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
		expect(selectNames('Could you fetch whether the window is open?')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
		expect(selectNames('Can you check whether the window is open?')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
		expect(selectNames('Can you check whether a window is open?')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
		expect(selectNames('Can you check whether the window is open and close it if it is?')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Can you check whether the window is open before you close it?')).toEqual(
			definitions.map((definition) => definition.name),
		);
	});

	it('treats an action verb used in an interrogative predicate as a state read', () => {
		expect(selectNames('Is the thermostat set to 20?')).toEqual([SEARCH_HOME_TOOL_NAME, QUERY_HOME_STATE_TOOL_NAME]);
		expect(selectNames('Is the thermostat set to 20')).toEqual([SEARCH_HOME_TOOL_NAME, QUERY_HOME_STATE_TOOL_NAME]);
		expect(selectNames('What is the thermostat set to?')).toEqual([SEARCH_HOME_TOOL_NAME, QUERY_HOME_STATE_TOOL_NAME]);
		expect(selectNames("What's the thermostat set to?")).toEqual([SEARCH_HOME_TOOL_NAME, QUERY_HOME_STATE_TOOL_NAME]);
		expect(selectNames('Was the thermostat set to 20?')).toEqual([SEARCH_HOME_TOOL_NAME, QUERY_HOME_STATE_TOOL_NAME]);
		expect(selectNames('Did I turn off the kitchen light?')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
		expect(selectNames('Could the window be open?')).toEqual([SEARCH_HOME_TOOL_NAME, QUERY_HOME_STATE_TOOL_NAME]);
		expect(selectNames('What has the thermostat been set to?')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
		expect(selectNames('What did I set the thermostat to?')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
		expect(selectNames('Why is the thermostat set to 20?')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
	});

	it('preserves actions in polite interrogative commands', () => {
		expect(selectNames('Are you able to turn off the kitchen light?')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			names.control,
			names.spaceLighting,
		]);
		expect(selectNames('Is it possible to turn off the kitchen light?')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			names.control,
			names.spaceLighting,
		]);
		expect(selectNames('Is there any way you can turn off the kitchen light?')).toEqual([
			SEARCH_HOME_TOOL_NAME,
			names.control,
			names.spaceLighting,
		]);
	});

	it('falls back conservatively for unknown verbs in polite adjustments', () => {
		expect(selectNames('Could you reduce the bedroom temperature?')).toEqual(
			definitions.map((definition) => definition.name),
		);
	});

	it('does not classify an explicit current-status question as a generic explanation', () => {
		expect(selectNames("What is a thermostat's current status?")).toEqual([
			SEARCH_HOME_TOOL_NAME,
			QUERY_HOME_STATE_TOOL_NAME,
		]);
	});

	it('falls back to every built-in tool for ambiguous home-related wording', () => {
		expect(selectNames('Help me with my smart home.')).toEqual(definitions.map((definition) => definition.name));
	});

	it.each(['Is Aurora on?', '¿Está encendida Aurora?', 'Tell me about Aurora.'])(
		'falls back to every built-in tool for unknown or low-confidence wording: %s',
		(message) => {
			expect(selectNames(message)).toEqual(definitions.map((definition) => definition.name));
		},
	);

	it('does not treat an entity-like question as confidently tool-free', () => {
		expect(selectNames('How is Morning?')).toEqual(definitions.map((definition) => definition.name));
		expect(selectNames('Tell me about Morning.')).toEqual(definitions.map((definition) => definition.name));
	});

	it('preserves tools for an ambiguous bare clarification reply', () => {
		expect(selectNames('Morning')).toEqual(definitions.map((definition) => definition.name));
		expect(selectNames('Good Morning')).toEqual(definitions.map((definition) => definition.name));
		expect(selectNames('Thank You')).toEqual(definitions.map((definition) => definition.name));
		expect(selectNames('Joke')).toEqual(definitions.map((definition) => definition.name));
	});

	it('falls back when an unrecognized action follows a read clause', () => {
		expect(selectNames('Find Evening and launch it.')).toEqual(definitions.map((definition) => definition.name));
		expect(selectNames('Execute Evening scene and show the kitchen temperature.')).toEqual(
			definitions.map((definition) => definition.name),
		);
	});

	it('falls back when an unrecognized action follows a recognized command', () => {
		expect(selectNames('Close the blinds and launch Evening.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Close the blinds. Launch Evening.')).toEqual(definitions.map((definition) => definition.name));
		expect(selectNames('Close the blinds plus launch Evening.')).toEqual(
			definitions.map((definition) => definition.name),
		);
		expect(selectNames('Close the blinds as well as launch Evening.')).toEqual(
			definitions.map((definition) => definition.name),
		);
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
