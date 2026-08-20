import {
	BUDDY_CONTEXT_EVALUATION_MATRIX,
	BuddyContextEvaluationCase,
} from '../testing/buddy-context-evaluation.matrix';

import { BuddyContextPlannerService } from './buddy-context-planner.service';

describe('BuddyContextPlannerService', () => {
	const service = new BuddyContextPlannerService();

	it.each(BUDDY_CONTEXT_EVALUATION_MATRIX)(
		'classifies the stable evaluation row: $id',
		(testCase: BuddyContextEvaluationCase) => {
			const toolCalling =
				testCase.expectedStrategy === 'deterministic-action' ? ('unsupported' as const) : ('reliable' as const);
			const recentEntityReferences = testCase.priorTurns?.flatMap((turn) => turn.entityReferences ?? []);
			const result = service.plan({
				message: testCase.message,
				conversationSpaceId: testCase.conversationSpaceId,
				recentEntityReferences,
				providerCapabilities: {
					toolCalling,
					supportsStructuredToolResults: toolCalling === 'reliable',
				},
			});

			expect(result.domains).toEqual(testCase.expectedDomains);
			expect(result.strategy).toBe(testCase.expectedStrategy);
			expect(['write', 'trigger', 'mixed'].includes(result.intent)).toBe(testCase.expectsAction);
		},
	);

	it('returns a stable multi-domain mixed plan with scoped bounded query labels', () => {
		expect(
			service.plan({
				message: 'If it is colder outside, lower the office thermostat',
				conversationSpaceId: 'space-office',
				knownSpaces: [{ id: 'space-office', name: 'Office' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toEqual({
			domains: ['home', 'weather'],
			intent: 'mixed',
			scope: { spaceId: 'space-office' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-office' },
				{ kind: 'current-state', spaceId: 'space-office' },
				{ kind: 'weather' },
			],
			toolNames: [],
			ambiguityRisk: 'none',
			strategy: 'deterministic-action',
		});
	});

	it('treats do and does action predicates as state reads', () => {
		expect(
			service.plan({
				message: 'Does the fan run?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ intent: 'read', strategy: 'model-tools', toolNames: ['search_home', 'query_home_state'] });
	});

	it('recognizes established target-dependent action verbs', () => {
		expect(
			service.plan({
				message: 'Stop bedroom fan',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			intent: 'mixed',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state', 'control_device', 'run_scene'],
		});
	});

	it('keeps established heating, cooling, lighting, and air categories on the home read path', () => {
		for (const message of ['Is the heating on?', 'What is the air quality?', 'Is cooling active?', 'List lighting']) {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ domains: ['home'], intent: 'read', strategy: 'model-tools' });
		}
	});

	it.each([
		{ message: 'Will it rain tomorrow?', query: { kind: 'weather' } },
		{ message: 'How much power did we use today?', query: { kind: 'energy-summary' } },
		{ message: 'Is the house secure?', query: { kind: 'security-status' } },
	])('prefetches $query.kind while no matching Buddy model tool exists', ({ message, query }) => {
		const result = service.plan({
			message,
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(result).toMatchObject({ strategy: 'prefetch', toolNames: [] });
		expect(result.queries).toContainEqual(query);
	});

	it('keeps outdoor temperature language on the weather-only path', () => {
		expect(
			service.plan({
				message: 'Will it be warm outside tomorrow?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['weather'],
			queries: [{ kind: 'weather' }],
			strategy: 'prefetch',
			toolNames: [],
		});
	});

	it.each(['Will it be sunny tomorrow?', 'Will it be cloudy tomorrow?'])(
		'routes a common weather condition to bounded weather retrieval: %s',
		(message) => {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ domains: ['weather'], queries: [{ kind: 'weather' }], strategy: 'prefetch' });
		},
	);

	it.each([
		{ message: 'What was the weather yesterday?', domains: ['weather'], query: { kind: 'weather' } },
		{
			message: 'How much energy did we use yesterday?',
			domains: ['energy'],
			query: { kind: 'energy-summary' },
		},
	])('keeps non-home history on its bounded $query.kind path', ({ message, domains, query }) => {
		const result = service.plan({
			message,
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(result.domains).toEqual(domains);
		expect(result.queries).toEqual([query]);
	});

	it('selects prefetch for tool-less reads and no tools for the provider', () => {
		const result = service.plan({
			message: 'Are any windows open?',
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(result).toMatchObject({
			domains: ['home'],
			intent: 'read',
			strategy: 'prefetch',
			toolNames: [],
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
		});
	});

	it('does not select model tools when structured tool results are unavailable', () => {
		const providerCapabilities = { toolCalling: 'reliable' as const, supportsStructuredToolResults: false };

		expect(service.plan({ message: 'Are any windows open?', providerCapabilities })).toMatchObject({
			intent: 'read',
			strategy: 'prefetch',
			toolNames: [],
		});
		expect(
			service.plan({
				message: 'Set kitchen light to 40%',
				providerCapabilities,
			}),
		).toMatchObject({
			intent: 'write',
			strategy: 'deterministic-action',
			toolNames: [],
		});
	});

	it.each([
		'Is the thermostat set to 20?',
		'What is the thermostat set to?',
		'Was the thermostat set to 20?',
		'Did I turn off the kitchen light?',
		'Did I run movie night?',
		'Which scenes can I run?',
		'Why is the thermostat set to 20?',
	])('keeps an action verb used in a state predicate on the read path: %s', (message) => {
		expect(
			service.plan({
				message,
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			intent: 'read',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state'],
		});
	});

	it.each(['Run it', 'Start that', 'Trigger them'])('clarifies unresolved trigger pronouns: %s', (message) => {
		expect(
			service.plan({
				message,
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it('requires a unique recent reference to match the requested action kind', () => {
		const providerCapabilities = { toolCalling: 'reliable' as const, supportsStructuredToolResults: true };
		const device = {
			kind: 'device' as const,
			id: 'device-lamp',
			name: 'Lamp',
			compatibleActionTypes: ['turn'] as const,
		};
		const scene = {
			kind: 'scene' as const,
			id: 'scene-movie-night',
			name: 'Movie night',
			compatibleActionTypes: ['run'] as const,
		};

		expect(service.plan({ message: 'Run it', recentEntityReferences: [device], providerCapabilities })).toMatchObject({
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
		expect(
			service.plan({ message: 'Turn it off', recentEntityReferences: [scene], providerCapabilities }),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
		expect(service.plan({ message: 'Run it', recentEntityReferences: [scene], providerCapabilities })).toMatchObject({
			scope: { referencedEntityIds: ['scene-movie-night'] },
			ambiguityRisk: 'none',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state', 'run_scene'],
		});
		expect(
			service.plan({ message: 'Turn it off', recentEntityReferences: [device], providerCapabilities }),
		).toMatchObject({
			scope: { referencedEntityIds: ['device-lamp'] },
			ambiguityRisk: 'none',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state', 'control_device'],
		});
	});

	it('uses a unique recent reference for a pronoun-only state read', () => {
		expect(
			service.plan({
				message: 'Is it on?',
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-reading-lamp',
						name: 'Reading lamp',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			scope: { referencedEntityIds: ['device-reading-lamp'] },
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
			strategy: 'model-tools',
		});
	});

	it('clarifies a singular pronoun state read with multiple recent references', () => {
		expect(
			service.plan({
				message: 'Is it on?',
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-left-lamp',
						name: 'Left lamp',
						compatibleActionTypes: ['turn'],
					},
					{
						kind: 'device',
						id: 'device-right-lamp',
						name: 'Right lamp',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ domains: ['home'], ambiguityRisk: 'read', strategy: 'clarify', toolNames: [] });
	});

	it('requires the recent reference to support the requested write operation', () => {
		const result = service.plan({
			message: 'Lock it',
			recentEntityReferences: [
				{
					kind: 'property',
					id: 'property-dimmer-level',
					name: 'Dimmer level',
					compatibleActionTypes: ['set'],
				},
			],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(result).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it('checks a pronoun reference only against the action in its clause', () => {
		expect(
			service.plan({
				message: 'Turn it off and run movie night',
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-lamp',
						name: 'Lamp',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { referencedEntityIds: ['device-lamp'] },
			ambiguityRisk: 'none',
			strategy: 'model-tools',
		});
	});

	it.each(['Are any windows open, close them if so', 'Is the bedroom cold? Turn off the heater'])(
		'preserves an action that follows a state predicate: %s',
		(message) => {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ intent: 'mixed' });
		},
	);

	it.each(['Is the bedroom cold. Turn off the heater.', 'Is the bedroom cold! Turn off the heater.'])(
		'preserves a sentence-separated action after a state predicate: %s',
		(message) => {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ intent: 'mixed' });
		},
	);

	it('preserves a polite modal action after a state question', () => {
		expect(
			service.plan({
				message: 'Is the bedroom cold? Could you turn off the heater?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ intent: 'mixed', strategy: 'model-tools' });
	});

	it('accepts politeness inside a modal action request', () => {
		expect(
			service.plan({
				message: 'Could you please turn off kitchen light?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ intent: 'write', strategy: 'model-tools' });
	});

	it.each([
		'Is it possible to turn off reading lamp?',
		'Are you able to turn off reading lamp?',
		'Is there any way you can turn off reading lamp?',
	])('recognizes an established action-request prefix: %s', (message) => {
		expect(
			service.plan({
				message,
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ intent: 'write', strategy: 'model-tools' });
	});

	it('keeps a modal state-read wrapper off the action path', () => {
		expect(
			service.plan({
				message: 'Could you tell me what the thermostat is set to?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			intent: 'read',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state'],
		});
	});

	it('retains a trailing read clause after a command', () => {
		const result = service.plan({
			message: 'Set kitchen thermostat to 20 and tell me whether the window is open',
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(result).toMatchObject({ intent: 'mixed', strategy: 'deterministic-action' });
		expect(result.queries).toContainEqual({ kind: 'current-state' });
	});

	it('retains a sentence-separated read clause after a command', () => {
		const result = service.plan({
			message: 'Turn off the heater. Tell me whether the window is open.',
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(result).toMatchObject({ intent: 'mixed', strategy: 'deterministic-action' });
		expect(result.queries).toContainEqual({ kind: 'current-state' });
	});

	it.each([
		'Run Bedtime and make sure the hallway sensor is triggered',
		'Run Bedtime and ensure the hallway sensor is triggered',
		'Run Bedtime and see whether the hallway sensor is triggered',
	])('retains an established trailing verification clause: %s', (message) => {
		const result = service.plan({
			message,
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(result).toMatchObject({ intent: 'mixed', strategy: 'deterministic-action' });
		expect(result.queries).toContainEqual({ kind: 'current-state' });
	});

	it('checks only the trailing action operation against a compound reference', () => {
		expect(
			service.plan({
				message: 'Are any windows open, close them if so',
				recentEntityReferences: [
					{
						kind: 'property',
						id: 'property-window-contact',
						name: 'Window contact',
						compatibleActionTypes: ['close'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'none', strategy: 'model-tools' });
	});

	it('retains every action in a command compound', () => {
		expect(
			service.plan({
				message: 'Turn kitchen light off and run movie night',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			intent: 'mixed',
			toolNames: ['search_home', 'query_home_state', 'control_device', 'run_scene'],
		});
	});

	it('does not attach a condition pronoun as an action reference', () => {
		expect(
			service.plan({
				message: 'If it is colder outside, lower the office thermostat',
				knownSpaces: [{ id: 'space-office', name: 'Office' }],
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-weather-station',
						name: 'Weather station',
						compatibleActionTypes: ['adjust'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ scope: {} });
	});

	it('does not attach a trailing condition pronoun as an action reference', () => {
		expect(
			service.plan({
				message: 'Turn kitchen light off if it is dark',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'none', intent: 'mixed', strategy: 'model-tools' });
	});

	it.each(['Once it gets dark, turn kitchen light on', 'As soon as the window opens, stop bedroom fan'])(
		'recognizes an established leading conditional action: %s',
		(message) => {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ ambiguityRisk: 'none', intent: 'mixed', strategy: 'model-tools' });
		},
	);

	it.each([
		'As long as it is dark, turn kitchen light on',
		'In case it is dark, turn kitchen light on',
		'Only if it is dark, turn kitchen light on',
		'So long as it is dark, turn kitchen light on',
	])('recognizes every established leading conditional prefix: %s', (message) => {
		expect(
			service.plan({
				message,
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'none', intent: 'mixed', strategy: 'model-tools' });
	});

	it('does not attach a trailing read pronoun as an action reference', () => {
		expect(
			service.plan({
				message: 'Turn kitchen light off and tell me whether it is dark',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'none', intent: 'mixed', strategy: 'model-tools' });
	});

	it('does not treat an action value as evidence of a unique target', () => {
		expect(
			service.plan({
				message: 'Set the lamp to 40%',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it('does not use conversation scope as proof that a generic action target is unique', () => {
		expect(
			service.plan({
				message: 'Turn on the lamp',
				conversationSpaceId: 'space-bedroom',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { spaceId: 'space-bedroom' },
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it('does not use an explicit room name as proof that a generic target is unique', () => {
		expect(
			service.plan({
				message: 'Turn on the bedroom lamp',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it.each(['Turn lights on', 'Turn bedroom lights on', 'Turn lamp on'])(
		'clarifies a bare generic action target: %s',
		(message) => {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
		},
	);

	it.each(['Open the window', 'Close doors', 'Lower the blinds', 'Set thermostat to 20'])(
		'clarifies an omitted generic device category: %s',
		(message) => {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
		},
	);

	it('clarifies a generic category target in an arbitrary known space', () => {
		expect(
			service.plan({
				message: 'Turn on the nursery lamp',
				knownSpaces: [{ id: 'space-nursery', name: 'Nursery' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { spaceId: 'space-nursery' },
			ambiguityRisk: 'action',
			strategy: 'clarify',
		});
	});

	it('keeps a known built-in space category target ambiguous', () => {
		expect(
			service.plan({
				message: 'Turn on the bedroom lamp',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { spaceId: 'space-bedroom' },
			ambiguityRisk: 'action',
			strategy: 'clarify',
		});
	});

	it('routes all lights in one resolved space to the group action tool', () => {
		const result = service.plan({
			message: 'Turn all bedroom lights off',
			knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(result).toMatchObject({
			scope: { spaceId: 'space-bedroom' },
			ambiguityRisk: 'none',
			strategy: 'model-tools',
		});
		expect(result.toolNames).toContain('set_space_lighting');
	});

	it('requires an all-lights clause to name its own resolved space', () => {
		expect(
			service.plan({
				message: 'Turn all lights off and set bedroom thermostat to 20',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { spaceId: 'space-bedroom' },
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it('advertises the group tool for every light in a resolved space', () => {
		const result = service.plan({
			message: 'Turn every bedroom light off',
			knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(result).toMatchObject({
			scope: { spaceId: 'space-bedroom' },
			ambiguityRisk: 'none',
			strategy: 'model-tools',
		});
		expect(result.toolNames).toContain('set_space_lighting');
	});

	it.each(['Turn on the lamp and set bedroom thermostat to 20', 'Turn all bedroom lights off and open the window'])(
		'does not let an exact action target hide ambiguity in another clause: %s',
		(message) => {
			expect(
				service.plan({
					message,
					knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
		},
	);

	it('keeps a declarative home-state observation on the read path', () => {
		expect(
			service.plan({
				message: 'The front door is open',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ intent: 'read', strategy: 'model-tools' });
	});

	it('recognizes an action-target pronoun separated by a determiner', () => {
		expect(
			service.plan({
				message: 'Turn the one off',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it('does not treat a word-valued action amount as a recent-entity reference', () => {
		expect(
			service.plan({
				message: 'Set kitchen light to one percent',
				knownSpaces: [{ id: 'space-kitchen', name: 'Kitchen' }],
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-old-light',
						name: 'Old light',
						compatibleActionTypes: ['set'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ scope: { spaceId: 'space-kitchen' }, ambiguityRisk: 'none', strategy: 'model-tools' });
	});

	it('keeps a subject-form plural pronoun follow-up on the home read path', () => {
		expect(
			service.plan({
				message: 'Are they on?',
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-lights',
						name: 'Lights',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			scope: { referencedEntityIds: ['device-lights'] },
			strategy: 'model-tools',
		});
	});

	it('retains every recent reference for a plural-pronoun state read', () => {
		expect(
			service.plan({
				message: 'Are they on?',
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-left-lamp',
						name: 'Left lamp',
						compatibleActionTypes: ['turn'],
					},
					{
						kind: 'device',
						id: 'device-right-lamp',
						name: 'Right lamp',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			scope: { referencedEntityIds: ['device-left-lamp', 'device-right-lamp'] },
			ambiguityRisk: 'none',
			strategy: 'model-tools',
		});
	});

	it('routes an installation-level home request to bounded home retrieval', () => {
		expect(
			service.plan({
				message: 'What is happening at home?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
			strategy: 'model-tools',
		});
	});

	it('routes run with an explicit device target to device control', () => {
		expect(
			service.plan({
				message: 'Run bedroom fan',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ intent: 'write', toolNames: ['search_home', 'query_home_state', 'control_device'] });
	});

	it('treats an explicit known space as a home-domain signal', () => {
		expect(
			service.plan({
				message: 'What is happening in the nursery?',
				knownSpaces: [{ id: 'space-nursery', name: 'Nursery' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			scope: { spaceId: 'space-nursery' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-nursery' },
				{ kind: 'current-state', spaceId: 'space-nursery' },
			],
		});
	});

	it('keeps explain-how questions on the general path', () => {
		expect(
			service.plan({
				message: 'Explain how a thermostat works',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ domains: ['general'], intent: 'none', queries: [], toolNames: [] });
	});

	it('keeps an installation-specific explanation on the scoped home path', () => {
		expect(
			service.plan({
				message: 'Explain why the bedroom is cold',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			scope: { spaceId: 'space-bedroom' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'current-state', spaceId: 'space-bedroom' },
			],
		});
	});

	it('keeps explicit-space discovery explanations on the scoped home path', () => {
		expect(
			service.plan({
				message: 'Explain what devices are in Nursery',
				knownSpaces: [{ id: 'space-nursery', name: 'Nursery' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			scope: { spaceId: 'space-nursery' },
			strategy: 'model-tools',
		});
	});

	it.each(['Turn on the outside light', 'Turn off the power switch'])(
		'keeps a domain keyword used in a device name on the home action path: %s',
		(message) => {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({
				domains: ['home'],
				intent: 'write',
				toolNames: ['search_home', 'query_home_state', 'control_device'],
			});
		},
	);

	it.each(['Is the outside light on?', 'What is the power switch state?'])(
		'keeps a domain keyword used in a device name on the home read path: %s',
		(message) => {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({
				domains: ['home'],
				intent: 'read',
				strategy: 'model-tools',
				queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
			});
		},
	);

	it('does not attach a stale home reference to an explicit weather question', () => {
		expect(
			service.plan({
				message: 'Is it raining?',
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-lamp',
						name: 'Lamp',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['weather'],
			intent: 'read',
			scope: {},
			queries: [{ kind: 'weather' }],
			strategy: 'prefetch',
		});
	});

	it('preserves a genuine weather signal beside an outside-light entity name', () => {
		expect(
			service.plan({
				message: 'Turn on the outside light when it is raining',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home', 'weather'],
			intent: 'mixed',
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }, { kind: 'weather' }],
			strategy: 'deterministic-action',
		});
	});

	it('classifies a home-state clause independently from a weather clause', () => {
		expect(
			service.plan({
				message: 'Will it rain tomorrow, and is the house warm?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home', 'weather'],
			intent: 'read',
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }, { kind: 'weather' }],
			strategy: 'prefetch',
		});
	});

	it('lets a unique recent reference override default conversation scope', () => {
		expect(
			service.plan({
				message: 'Is it on?',
				conversationSpaceId: 'space-office',
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-kitchen-lamp',
						name: 'Kitchen lamp',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			scope: { referencedEntityIds: ['device-kitchen-lamp'] },
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
		});
	});

	it('preserves an energy read in a compound action request', () => {
		expect(
			service.plan({
				message: 'How much power did we use yesterday, then set kitchen light to 40%',
				knownSpaces: [{ id: 'space-kitchen', name: 'Kitchen' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home', 'energy'],
			intent: 'mixed',
			queries: [
				{ kind: 'search-home', spaceId: 'space-kitchen' },
				{ kind: 'energy-summary', spaceId: 'space-kitchen' },
			],
			strategy: 'deterministic-action',
		});
	});

	it('includes live state in an explicit historical comparison', () => {
		expect(
			service.plan({
				message: 'What was the bedroom temperature yesterday, and what is the current temperature?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home', 'history'],
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'current-state', spaceId: 'space-bedroom' },
				{ kind: 'property-timeseries', spaceId: 'space-bedroom' },
			],
		});
	});

	it('routes a past-tense request bounded by today to history', () => {
		expect(
			service.plan({
				message: 'What was the bedroom temperature today?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home', 'history'],
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'property-timeseries', spaceId: 'space-bedroom' },
			],
		});
	});

	it('detects an action after a direct read command', () => {
		expect(
			service.plan({
				message: 'Check whether the window is open, then turn off the heater',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'mixed',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state', 'control_device'],
		});
	});

	it.each(['plus', 'as well as', 'and also'])(
		'recognizes an action after an established compound separator: %s',
		(separator) => {
			expect(
				service.plan({
					message: `Check whether the window is open ${separator} turn off the heater`,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({
				domains: ['home'],
				intent: 'mixed',
				strategy: 'model-tools',
				toolNames: ['search_home', 'query_home_state', 'control_device'],
			});
		},
	);

	it.each(['plus', 'as well as', 'and also'])(
		'recognizes a read after an established compound separator: %s',
		(separator) => {
			expect(
				service.plan({
					message: `Turn off the heater ${separator} check whether the window is open`,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({
				domains: ['home'],
				intent: 'mixed',
				queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
				strategy: 'model-tools',
			});
		},
	);

	it('uses metadata search without current-state reads for capability discovery', () => {
		expect(
			service.plan({
				message: 'Which lights can I dim?',
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			strategy: 'prefetch',
			queries: [{ kind: 'search-home' }],
		});
	});

	it('uses metadata search for modal capability discovery', () => {
		expect(
			service.plan({
				message: 'Can you show me which lights I can dim?',
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			strategy: 'prefetch',
			queries: [{ kind: 'search-home' }],
		});
	});

	it.each([
		{ message: 'Are any windows open in the whole house?', knownSpaces: [], expectedScope: {} },
		{
			message: 'What is the nursery temperature?',
			knownSpaces: [
				{ id: 'space-office', name: 'Office' },
				{ id: 'space-nursery', name: 'Nursery' },
			],
			expectedScope: { spaceId: 'space-nursery' },
		},
	])(
		'uses explicit global or named-space scope instead of conversation scope: $message',
		({ message, knownSpaces, expectedScope }) => {
			const result = service.plan({
				message,
				conversationSpaceId: 'space-office',
				knownSpaces,
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			});

			expect(result.scope).toEqual(expectedScope);
			expect(result.queries).not.toContainEqual(expect.objectContaining({ spaceId: 'space-office' }));
		},
	);

	it('drops conversation scope for an unresolved explicit built-in room', () => {
		const result = service.plan({
			message: 'What is the kitchen temperature?',
			conversationSpaceId: 'space-office',
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(result).toMatchObject({ domains: ['home'], intent: 'read', scope: {} });
		expect(result.queries).toEqual([{ kind: 'search-home' }, { kind: 'current-state' }]);
	});

	it('retains every configured space in an explicit multi-space read', () => {
		expect(
			service.plan({
				message: 'What is the temperature in Bedroom and Kitchen?',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				conversationSpaceId: 'space-office',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			scope: { spaceIds: ['space-bedroom', 'space-kitchen'] },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'search-home', spaceId: 'space-kitchen' },
				{ kind: 'current-state', spaceId: 'space-bedroom' },
				{ kind: 'current-state', spaceId: 'space-kitchen' },
			],
		});
	});

	it('prefers the longest overlapping explicit space name', () => {
		const result = service.plan({
			message: 'What is the temperature in Bedroom 2?',
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-bedroom-2', name: 'Bedroom 2' },
			],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(result.scope).toEqual({ spaceId: 'space-bedroom-2' });
		expect(result.queries).toEqual([
			{ kind: 'search-home', spaceId: 'space-bedroom-2' },
			{ kind: 'current-state', spaceId: 'space-bedroom-2' },
		]);
	});

	it('keeps target-dependent start verbs available to compatible action tools', () => {
		expect(
			service.plan({
				message: 'Start the bedroom fan',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'mixed',
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it.each(['What was the bedroom temperature yesterday?', 'Graph the temperature for 2026-08-15'])(
		'routes relative and explicit historical dates to timeseries: %s',
		(message) => {
			const result = service.plan({
				message,
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			});

			expect(result.domains).toEqual(['home', 'history']);
			expect(result.queries).toEqual([{ kind: 'search-home' }, { kind: 'property-timeseries' }]);
		},
	);

	it('routes a relative duration ending in ago to timeseries', () => {
		expect(
			service.plan({
				message: 'What was the bedroom temperature 2 hours ago?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home', 'history'],
			queries: [{ kind: 'search-home' }, { kind: 'property-timeseries' }],
		});
	});

	it('routes a numeric last-duration range to timeseries', () => {
		expect(
			service.plan({
				message: 'What was the bedroom temperature in the last 24 hours?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home', 'history'],
			queries: [{ kind: 'search-home' }, { kind: 'property-timeseries' }],
		});
	});

	it('retains current state alongside a historical comparison', () => {
		const result = service.plan({
			message: 'What was the bedroom temperature yesterday, and what is it now?',
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(result.domains).toEqual(['home', 'history']);
		expect(result.queries).toEqual([
			{ kind: 'search-home' },
			{ kind: 'current-state' },
			{ kind: 'property-timeseries' },
		]);
	});

	it('uses a unique recent reference and clarifies missing or ambiguous pronouns', () => {
		const providerCapabilities = { toolCalling: 'unsupported' as const, supportsStructuredToolResults: false };
		const reference = {
			kind: 'device' as const,
			id: 'device-reading-lamp',
			name: 'Reading lamp',
			compatibleActionTypes: ['turn'] as const,
		};

		expect(
			service.plan({ message: 'Turn it off', recentEntityReferences: [reference], providerCapabilities }),
		).toMatchObject({
			scope: { referencedEntityIds: ['device-reading-lamp'] },
			ambiguityRisk: 'none',
			strategy: 'deterministic-action',
		});
		expect(service.plan({ message: 'Turn it off', providerCapabilities })).toMatchObject({
			ambiguityRisk: 'action',
			strategy: 'clarify',
		});
		expect(
			service.plan({
				message: 'Turn them off',
				recentEntityReferences: [
					reference,
					{
						kind: 'device',
						id: 'device-desk-lamp',
						name: 'Desk lamp',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities,
			}),
		).toMatchObject({
			ambiguityRisk: 'action',
			strategy: 'clarify',
		});
	});

	it('uses conversation scope as a retrieval hint and flags missing contextual scope', () => {
		const providerCapabilities = { toolCalling: 'reliable' as const, supportsStructuredToolResults: true };

		expect(
			service.plan({
				message: 'Is it too warm in here?',
				conversationSpaceId: 'space-bedroom',
				providerCapabilities,
			}),
		).toMatchObject({ scope: { spaceId: 'space-bedroom' }, ambiguityRisk: 'none', strategy: 'model-tools' });
		expect(service.plan({ message: 'Is it too warm in here?', providerCapabilities })).toMatchObject({
			ambiguityRisk: 'read',
			strategy: 'clarify',
		});
	});

	it('keeps general explanations and unsupported domains free of home queries and tools', () => {
		for (const message of [
			'How does a thermostat work?',
			'Show me how to turn off the kitchen light.',
			'Book a flight',
		]) {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toEqual({
				domains: ['general'],
				intent: 'none',
				scope: {},
				queries: [],
				toolNames: [],
				ambiguityRisk: 'none',
				strategy: 'no-home-context',
			});
		}
	});
});
