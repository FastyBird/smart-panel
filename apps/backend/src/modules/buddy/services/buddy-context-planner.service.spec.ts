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
			intent: 'write',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state', 'control_device'],
		});
	});

	it('clarifies a localized bare-category action target', () => {
		expect(
			service.plan({
				message: 'Zapni světlo',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'write',
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it('reuses localized home vocabulary for state reads', () => {
		expect(
			service.plan({
				message: 'Je světlo zapnuté?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state'],
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

	it.each(['Are the fans on?', 'List sensors', 'Which scenes are active?', 'List switches', 'List thermostats'])(
		'keeps a plural home category on the home read path: %s',
		(message) => {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ domains: ['home'], intent: 'read', strategy: 'model-tools' });
		},
	);

	it.each([
		{ message: 'Will it rain tomorrow?', query: { kind: 'weather' } },
		{ message: 'How much power did we use today?', query: { kind: 'energy-summary' } },
		{ message: 'How much electricity did we use today?', query: { kind: 'energy-summary' } },
		{ message: 'Is the house secure?', query: { kind: 'security-status' } },
	])('prefetches $query.kind while no matching Buddy model tool exists', ({ message, query }) => {
		const result = service.plan({
			message,
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(result).toMatchObject({ strategy: 'prefetch', toolNames: [] });
		expect(result.queries).toContainEqual(query);
	});

	it.each([
		'Will it be warm outside tomorrow?',
		'What is the outdoor temperature?',
		'What will the temperature be tomorrow?',
	])('keeps outdoor temperature language on the weather-only path: %s', (message) => {
		expect(
			service.plan({
				message,
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['weather'],
			queries: [{ kind: 'weather' }],
			strategy: 'prefetch',
			toolNames: [],
		});
	});

	it('keeps an unqualified current configured-space temperature on the home path', () => {
		expect(
			service.plan({
				message: 'What is the Bedroom temperature?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			scope: { spaceId: 'space-bedroom' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'current-state', spaceId: 'space-bedroom' },
			],
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

	it('clarifies an unresolved action after an intervening read clause', () => {
		expect(
			service.plan({
				message: 'Turn kitchen light off, check whether the window is open, then close it',
				knownSpaces: [{ id: 'space-kitchen', name: 'Kitchen' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
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
				message: 'Is the bedroom cold? Could you turn off the reading lamp?',
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
			message: 'Turn off the reading lamp. Tell me whether the window is open.',
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

	it.each([
		'Turn Reading Lamp off, and how warm is the Bedroom?',
		'Turn Reading Lamp off, and can you check the Bedroom temperature?',
	])('retains a trailing interrogative or modal read clause: %s', (message) => {
		const result = service.plan({
			message,
			knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(result).toMatchObject({ intent: 'mixed', strategy: 'deterministic-action' });
		expect(result.queries).toContainEqual({ kind: 'current-state', spaceId: 'space-bedroom' });
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

	it('clarifies disjunctive action alternatives instead of selecting one', () => {
		expect(
			service.plan({
				message: 'Run Movie Night or run Bedtime',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'trigger',
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
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

	it('recognizes an unpunctuated leading conditional action', () => {
		expect(
			service.plan({
				message: 'If the window is open turn the Bedroom lights off',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			intent: 'mixed',
			scope: { spaceId: 'space-bedroom' },
			ambiguityRisk: 'none',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state', 'control_device', 'set_space_lighting'],
		});
	});

	it.each([
		'If the window is open, will the heater turn on?',
		'If the window is open, when will the heater turn on?',
		'If the window is open will the heater turn on?',
		'If the window is open, should the heater turn on?',
		'If the window is open must the heater turn on?',
		'If the window is open does the heater turn on?',
	])('keeps a conditional outcome question on the read path: %s', (message) => {
		expect(
			service.plan({
				message,
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
			ambiguityRisk: 'none',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state'],
		});
	});

	it('retains a polite action request after a leading condition', () => {
		expect(
			service.plan({
				message: 'If the window is open, could you turn the Bedroom lights off?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			intent: 'mixed',
			scope: { spaceId: 'space-bedroom' },
			ambiguityRisk: 'none',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state', 'control_device', 'set_space_lighting'],
		});
	});

	it('splits a Czech action compound only when a follows with an action', () => {
		expect(
			service.plan({
				message: 'Nastav ho a spusť Movie Night',
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-thermostat',
						name: 'Thermostat',
						compatibleActionTypes: ['set'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			intent: 'mixed',
			scope: { referencedEntityIds: ['device-thermostat'] },
			ambiguityRisk: 'none',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state', 'control_device', 'run_scene'],
		});
	});

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

	it.each(['Open the window', 'Close doors', 'Lower the blinds', 'Set thermostat to 20', 'Turn off the heater'])(
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

	it('routes resolved plural room lighting to the group action tool', () => {
		const result = service.plan({
			message: 'Turn Bedroom lights off',
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
				message: 'Set Kitchen Accent to one percent',
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

	it('clarifies run with an articleless category target in a built-in space', () => {
		expect(
			service.plan({
				message: 'Run bedroom fan',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ intent: 'write', ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it('clarifies a fan category in a room-named space', () => {
		expect(
			service.plan({
				message: 'Turn living room fan on',
				knownSpaces: [{ id: 'space-living-room', name: 'Living room' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { spaceId: 'space-living-room' },
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it('does not combine lighting-group signals across action clauses', () => {
		expect(
			service.plan({
				message: 'Turn desk lamp on and turn living room air handler on',
				knownSpaces: [{ id: 'space-living-room', name: 'Living room' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state', 'control_device'],
		});
	});

	it('classifies a scene run independently from a later device-run target', () => {
		expect(
			service.plan({
				message: 'Run movie night then turn bedroom air handler on',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'mixed',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state', 'control_device', 'run_scene'],
		});
	});

	it('does not classify a trigger verb inside a read clause as a command', () => {
		expect(
			service.plan({
				message: 'Turn on Reading Lamp, then check whether Movie Night will run',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			intent: 'mixed',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state', 'control_device'],
		});
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

	it('keeps article-led conceptual questions on the general path', () => {
		expect(
			service.plan({
				message: 'What does a thermostat do?',
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
	});

	it('keeps unrelated general-knowledge home nouns off retrieval', () => {
		expect(
			service.plan({
				message: 'How many windows does a Boeing 747 have?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['general'],
			intent: 'none',
			queries: [],
			toolNames: [],
			strategy: 'no-home-context',
		});
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

	it('keeps a possessive installation explanation on the home path', () => {
		expect(
			service.plan({
				message: 'Explain why my thermostat is cold',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
			strategy: 'model-tools',
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

	it('keeps a security keyword used in a device name on the home action path', () => {
		expect(
			service.plan({
				message: 'Turn on the security light',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'write',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state', 'control_device'],
		});
	});

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

	it('does not treat an outdoor device name as a weather request', () => {
		expect(
			service.plan({
				message: 'Turn on the outdoor light',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'write',
			queries: [{ kind: 'search-home' }],
			strategy: 'model-tools',
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
				message: 'How much power did we use yesterday, then set Kitchen Accent to 40%',
				knownSpaces: [{ id: 'space-kitchen', name: 'Kitchen' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home', 'energy'],
			intent: 'mixed',
			queries: [{ kind: 'search-home', spaceId: 'space-kitchen' }, { kind: 'energy-summary' }],
			strategy: 'deterministic-action',
		});
	});

	it('preserves a predicate read after an action clause', () => {
		expect(
			service.plan({
				message: 'Turn Reading Lamp off, and is Bedroom Window open?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'mixed',
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'current-state', spaceId: 'space-bedroom' },
			],
			strategy: 'deterministic-action',
		});
	});

	it('uses a resolved contextual room for a lighting group action', () => {
		expect(
			service.plan({
				message: 'Turn all lights off in this room',
				conversationSpaceId: 'space-kitchen',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'write',
			scope: { spaceId: 'space-kitchen' },
			ambiguityRisk: 'none',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state', 'control_device', 'set_space_lighting'],
		});
	});

	it('scopes energy and home-state queries from their own clauses', () => {
		expect(
			service.plan({
				message: 'How much energy did the house use, and what is the Bedroom temperature?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home', 'energy'],
			scope: { spaceId: 'space-bedroom' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'current-state', spaceId: 'space-bedroom' },
				{ kind: 'energy-summary' },
			],
		});
	});

	it('keeps a contextual live clause in conversation scope beside scoped energy', () => {
		expect(
			service.plan({
				message: 'How much energy did Bedroom use, and what is the temperature here?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				conversationSpaceId: 'space-office',
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			queries: [
				{ kind: 'search-home', spaceId: 'space-office' },
				{ kind: 'current-state', spaceId: 'space-office' },
				{ kind: 'energy-summary', spaceId: 'space-bedroom' },
			],
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

	it('scopes current and historical clauses independently', () => {
		expect(
			service.plan({
				message: 'What was the Bedroom temperature yesterday, and what is the Kitchen temperature now?',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			scope: { spaceIds: ['space-bedroom', 'space-kitchen'] },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'search-home', spaceId: 'space-kitchen' },
				{ kind: 'current-state', spaceId: 'space-kitchen' },
				{ kind: 'property-timeseries', spaceId: 'space-bedroom' },
			],
		});
	});

	it('retains an implicit-current clause beside a historical clause', () => {
		expect(
			service.plan({
				message: 'What was the Bedroom temperature yesterday, and what is the Kitchen temperature?',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'search-home', spaceId: 'space-kitchen' },
				{ kind: 'current-state', spaceId: 'space-kitchen' },
				{ kind: 'property-timeseries', spaceId: 'space-bedroom' },
			],
		});
	});

	it('scopes current and historical spans independently within one clause', () => {
		expect(
			service.plan({
				message: 'Compare the current Kitchen temperature with Bedroom yesterday',
				knownSpaces: [
					{ id: 'space-kitchen', name: 'Kitchen' },
					{ id: 'space-bedroom', name: 'Bedroom' },
				],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			scope: { spaceIds: ['space-kitchen', 'space-bedroom'] },
			queries: [
				{ kind: 'search-home', spaceId: 'space-kitchen' },
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'current-state', spaceId: 'space-kitchen' },
				{ kind: 'property-timeseries', spaceId: 'space-bedroom' },
			],
		});
	});

	it('keeps an unqualified temporal clause in conversation scope', () => {
		expect(
			service.plan({
				message: 'What was the temperature yesterday, and what is the Bedroom temperature now?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				conversationSpaceId: 'space-office',
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'search-home', spaceId: 'space-office' },
				{ kind: 'current-state', spaceId: 'space-bedroom' },
				{ kind: 'property-timeseries', spaceId: 'space-office' },
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

	it('keeps present-tense possession bounded by today on the current-state path', () => {
		expect(
			service.plan({
				message: 'What devices have low batteries today?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
		});
	});

	it('retains have-been wording as a historical today request', () => {
		expect(
			service.plan({
				message: 'Which lights have been on today?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home', 'history'],
			queries: [{ kind: 'search-home' }, { kind: 'property-timeseries' }],
		});
	});

	it('detects an action after a direct read command', () => {
		expect(
			service.plan({
				message: 'Check whether the window is open, then turn off the reading lamp',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'mixed',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state', 'control_device'],
		});
	});

	it.each(['Tell me', 'Confirm'])('inspects a trailing action after a direct %s read prefix', (readPrefix) => {
		expect(
			service.plan({
				message: `${readPrefix} whether the window is open, then turn off Reading Heater`,
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
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
					message: `Check whether the window is open ${separator} turn off the reading lamp`,
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
					message: `Turn off the reading lamp ${separator} check whether the window is open`,
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
		{ message: 'What is the temperature in every room?', knownSpaces: [], expectedScope: {} },
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

	it('keeps conjoined configured spaces under one temporal qualifier', () => {
		expect(
			service.plan({
				message: 'What were the Bedroom and Kitchen temperatures yesterday?',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home', 'history'],
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'search-home', spaceId: 'space-kitchen' },
				{ kind: 'property-timeseries', spaceId: 'space-bedroom' },
				{ kind: 'property-timeseries', spaceId: 'space-kitchen' },
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
			intent: 'write',
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

	it.each(['When did the Bedroom light turn off?', 'What was the Bedroom temperature two days ago?'])(
		'routes past-tense and word-number history phrasing to timeseries: %s',
		(message) => {
			expect(
				service.plan({
					message,
					knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
					providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
				}),
			).toMatchObject({
				domains: ['home', 'history'],
				intent: 'read',
				queries: [
					{ kind: 'search-home', spaceId: 'space-bedroom' },
					{ kind: 'property-timeseries', spaceId: 'space-bedroom' },
				],
				toolNames: [],
				strategy: 'prefetch',
			});
		},
	);

	it.each([
		'What was the Bedroom temperature last Tuesday?',
		'Show the Bedroom temperature since Monday',
		'What was the Bedroom temperature on Monday?',
		'On Monday, what was the Bedroom temperature?',
	])('routes weekday history phrasing to timeseries: %s', (message) => {
		expect(
			service.plan({
				message,
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

	it('routes a natural-language calendar date to timeseries', () => {
		expect(
			service.plan({
				message: 'What was the Bedroom temperature on August 19?',
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

	it('keeps a historical recent-reference follow-up independent of conversation space', () => {
		expect(
			service.plan({
				message: 'What was its temperature yesterday?',
				conversationSpaceId: 'space-office',
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-hall-thermostat',
						name: 'Hall thermostat',
						compatibleActionTypes: ['set'],
					},
				],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home', 'history'],
			scope: { referencedEntityIds: ['device-hall-thermostat'] },
			queries: [{ kind: 'search-home' }, { kind: 'property-timeseries' }],
		});
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
			'How did thermostats work in 1950?',
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

	it('clarifies a shared generic category across conjoined configured spaces', () => {
		expect(
			service.plan({
				message: 'Set Bedroom and Kitchen thermostats to 20',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'write',
			scope: { spaceIds: ['space-bedroom', 'space-kitchen'] },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'search-home', spaceId: 'space-kitchen' },
			],
			toolNames: [],
			ambiguityRisk: 'action',
			strategy: 'clarify',
		});
	});

	it('preserves a conjunction inside a multi-space lighting target', () => {
		expect(
			service.plan({
				message: 'Turn Bedroom and Kitchen lights off',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { spaceIds: ['space-bedroom', 'space-kitchen'] },
			ambiguityRisk: 'none',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state', 'control_device', 'set_space_lighting'],
		});
	});

	it('clarifies disjunctive multi-space lighting alternatives', () => {
		expect(
			service.plan({
				message: 'Turn Bedroom or Kitchen lights off',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { spaceIds: ['space-bedroom', 'space-kitchen'] },
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it('keeps separately named singular lamps out of the room-lighting group path', () => {
		expect(
			service.plan({
				message: 'Turn the Bedroom lamp and Kitchen lamp off',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { spaceIds: ['space-bedroom', 'space-kitchen'] },
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it('uses a unique recent reference for a possessive entity pronoun', () => {
		expect(
			service.plan({
				message: 'What is its temperature?',
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-hall-thermostat',
						name: 'Hall thermostat',
						compatibleActionTypes: ['set'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { referencedEntityIds: ['device-hall-thermostat'] },
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
		});
	});

	it('reuses localized lighting-group vocabulary', () => {
		expect(
			service.plan({
				message: 'Zapni světla v ložnici',
				knownSpaces: [{ id: 'space-bedroom', name: 'Ložnice' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			ambiguityRisk: 'none',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state', 'control_device', 'set_space_lighting'],
		});
	});

	it('prefetches a leading state read before a trailing action', () => {
		expect(
			service.plan({
				message: 'Is the window open, and turn off Reading Lamp',
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			intent: 'mixed',
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
			strategy: 'deterministic-action',
		});
	});

	it('clarifies an articleless lamp category in a built-in space', () => {
		expect(
			service.plan({
				message: 'Turn on bedroom lamp',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it('preserves a recent home reference beside an unrelated weather clause', () => {
		expect(
			service.plan({
				message: 'Will it rain tomorrow, and is it on?',
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-reading-lamp',
						name: 'Reading lamp',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home', 'weather'],
			scope: { referencedEntityIds: ['device-reading-lamp'] },
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }, { kind: 'weather' }],
		});
	});

	it('routes a category-free custom device state question through bounded search', () => {
		expect(
			service.plan({
				message: 'Is Aurora on?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state'],
		});
	});

	it('does not treat a conditional state predicate as a second write', () => {
		expect(
			service.plan({
				message: 'Run Movie Night if the window is open',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			intent: 'mixed',
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
			toolNames: ['search_home', 'query_home_state', 'run_scene'],
		});
	});

	it.each(['Increase the bedroom thermostat by 2 degrees', 'Brighten the bedroom lamp'])(
		'prefetches baseline state for a relative adjustment: %s',
		(message) => {
			expect(
				service.plan({
					message,
					knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
					providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
				}),
			).toMatchObject({
				intent: 'mixed',
				queries: [
					{ kind: 'search-home', spaceId: 'space-bedroom' },
					{ kind: 'current-state', spaceId: 'space-bedroom' },
				],
			});
		},
	);

	it('uses an explicit space only to scope a domain-specific energy read', () => {
		expect(
			service.plan({
				message: 'How much energy did Nursery use?',
				knownSpaces: [{ id: 'space-nursery', name: 'Nursery' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['energy'],
			queries: [{ kind: 'energy-summary', spaceId: 'space-nursery' }],
		});
	});

	it.each(['Vypni ho', 'Vypni to'])('resolves a localized reference pronoun: %s', (message) => {
		expect(
			service.plan({
				message,
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
			scope: { referencedEntityIds: ['device-reading-lamp'] },
			ambiguityRisk: 'none',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state', 'control_device'],
		});
	});

	it('resolves a Czech state-reference pronoun and clarifies when it is missing', () => {
		const providerCapabilities = { toolCalling: 'reliable' as const, supportsStructuredToolResults: true };
		const message = 'Je to otevřené?';

		expect(
			service.plan({
				message,
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-window',
						name: 'Window',
						compatibleActionTypes: ['open'],
					},
				],
				providerCapabilities,
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			scope: { referencedEntityIds: ['device-window'] },
			ambiguityRisk: 'none',
			strategy: 'model-tools',
		});
		expect(service.plan({ message, providerCapabilities })).toMatchObject({
			domains: ['home'],
			intent: 'read',
			ambiguityRisk: 'read',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it.each([
		'What was the bedroom temperature in the last hour?',
		'What was the bedroom temperature in the last day?',
		'What was the bedroom temperature an hour ago?',
	])('routes a singular relative history range to timeseries: %s', (message) => {
		expect(
			service.plan({
				message,
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home', 'history'],
			queries: [{ kind: 'search-home' }, { kind: 'property-timeseries' }],
		});
	});

	it('clarifies an articleless fan category in a built-in space', () => {
		expect(
			service.plan({
				message: 'Turn bedroom fan on',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it('lets an explicit house scope override conversation scope', () => {
		expect(
			service.plan({
				message: 'Are any windows in the house open?',
				conversationSpaceId: 'space-office',
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			scope: {},
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
		});
	});

	it('preserves an explicit room span inside a mixed weather clause', () => {
		expect(
			service.plan({
				message: 'Compare the outside temperature with Bedroom temperature',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				conversationSpaceId: 'space-office',
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home', 'weather'],
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'current-state', spaceId: 'space-bedroom' },
				{ kind: 'weather' },
			],
		});
	});

	it('keeps a domain word inside a scene name on the action path', () => {
		expect(
			service.plan({
				message: 'Run Security Night',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'trigger',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state', 'run_scene'],
		});
	});

	it('keeps an outside-temperature request on the weather-only path', () => {
		expect(
			service.plan({
				message: 'What is the outside temperature?',
				conversationSpaceId: 'space-office',
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['weather'],
			queries: [{ kind: 'weather' }],
		});
	});

	it.each([
		['Are the outside lights on?', ['home']],
		['Are the power switches on?', ['home']],
		['Are the security sensors active?', ['home']],
	] as const)('treats plural domain-prefixed entity names as home targets: %s', (message, domains) => {
		expect(
			service.plan({
				message,
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains,
			intent: 'read',
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
		});
	});

	it.each([
		'Pokud je okno otevřené, zapni Auroru',
		'Když je okno otevřené, zapni Auroru',
		'Jakmile je otevřené, zapni Auroru',
	])('retains localized conditional state reads before an action: %s', (message) => {
		expect(
			service.plan({
				message,
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'mixed',
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
			strategy: 'deterministic-action',
		});
	});

	it('keeps an unrelated historical question off home retrieval', () => {
		expect(
			service.plan({
				message: 'What happened yesterday?',
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
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
	});

	it('clarifies a singular home-state pronoun without a recent reference', () => {
		expect(
			service.plan({
				message: 'Is it on?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			ambiguityRisk: 'read',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it('clarifies every-light actions without a resolved space', () => {
		expect(
			service.plan({
				message: 'Turn every light off',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it('preserves whole-house home scope inside a mixed security read', () => {
		expect(
			service.plan({
				message: 'Is the house secure, and are any windows in the house open?',
				conversationSpaceId: 'space-office',
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home', 'security'],
			scope: {},
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }, { kind: 'security-status' }],
		});
	});

	it('keeps a historical outside-temperature request on weather retrieval', () => {
		expect(
			service.plan({
				message: 'What was the outside temperature yesterday?',
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['weather'],
			queries: [{ kind: 'weather' }],
		});
	});

	it("routes a custom device label's status through bounded home state", () => {
		expect(
			service.plan({
				message: "What is Aurora's status?",
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
			strategy: 'model-tools',
		});
	});

	it('recognizes a localized read-then-action connector', () => {
		expect(
			service.plan({
				message: 'Je okno otevřené a vypni světlo',
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'mixed',
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
			ambiguityRisk: 'action',
			strategy: 'clarify',
		});
	});

	it('keeps the English indefinite article inside a generic action target', () => {
		expect(
			service.plan({
				message: 'Turn on a light',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it('clarifies mixed disjunctive and conjunctive room-lighting scopes', () => {
		expect(
			service.plan({
				message: 'Turn Bedroom or Kitchen and Office lights off',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
					{ id: 'space-office', name: 'Office' },
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { spaceIds: ['space-bedroom', 'space-kitchen', 'space-office'] },
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it('clarifies a whole-room lighting group with an exclusion', () => {
		expect(
			service.plan({
				message: 'Turn all lights in here off except the desk lamp',
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

	it('preserves connector words inside a configured space name', () => {
		expect(
			service.plan({
				message: 'How much energy did Research and Development use?',
				knownSpaces: [{ id: 'space-research-development', name: 'Research and Development' }],
				conversationSpaceId: 'space-office',
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['energy'],
			scope: { spaceId: 'space-research-development' },
			queries: [{ kind: 'energy-summary', spaceId: 'space-research-development' }],
		});
	});

	it('preserves longest configured-space matches independently per occurrence', () => {
		expect(
			service.plan({
				message: 'How much energy did Living Room use and what is Room temperature?',
				knownSpaces: [
					{ id: 'space-living-room', name: 'Living Room' },
					{ id: 'space-room', name: 'Room' },
				],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home', 'energy'],
			scope: { spaceIds: ['space-living-room', 'space-room'] },
			queries: [
				{ kind: 'search-home', spaceId: 'space-room' },
				{ kind: 'current-state', spaceId: 'space-room' },
				{ kind: 'energy-summary', spaceId: 'space-living-room' },
			],
		});
	});

	it('does not resolve a relative-clause that as a recent reference', () => {
		expect(
			service.plan({
				message: 'Show devices that are off',
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
			scope: {},
			ambiguityRisk: 'none',
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
		});
	});

	it('clarifies a plural home-state pronoun without recent references', () => {
		expect(
			service.plan({
				message: 'Are they on?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			ambiguityRisk: 'read',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it.each([
		['Energy', 'space-energy'],
		['Security', 'space-security'],
		['Weather Room', 'space-weather-room'],
	])('masks the configured space name %s during domain detection', (spaceName, spaceId) => {
		expect(
			service.plan({
				message: `What is the ${spaceName} temperature?`,
				knownSpaces: [{ id: spaceId, name: spaceName }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			scope: { spaceId },
			queries: [
				{ kind: 'search-home', spaceId },
				{ kind: 'current-state', spaceId },
			],
			strategy: 'model-tools',
		});
	});

	it.each(['What is the temperature everywhere except Bedroom?', 'What is the temperature everywhere but Bedroom?'])(
		'clarifies a read whose only explicit space is excluded: %s',
		(message) => {
			expect(
				service.plan({
					message,
					knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
					conversationSpaceId: 'space-office',
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({
				domains: ['home'],
				scope: {},
				ambiguityRisk: 'read',
				strategy: 'clarify',
				toolNames: [],
			});
		},
	);

	it('does not resolve temporal this as a recent entity reference', () => {
		expect(
			service.plan({
				message: 'Was the Bedroom warm this morning?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				recentEntityReferences: [
					{
						kind: 'property',
						id: 'property-stale',
						name: 'Stale reference',
						compatibleActionTypes: ['set'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home', 'history'],
			scope: { spaceId: 'space-bedroom' },
			ambiguityRisk: 'none',
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'property-timeseries', spaceId: 'space-bedroom' },
			],
			strategy: 'prefetch',
		});
	});

	it('clarifies a lighting target shared by duplicate configured space names', () => {
		expect(
			service.plan({
				message: 'Turn Office lights off',
				knownSpaces: [
					{ id: 'space-office-east', name: 'Office' },
					{ id: 'space-office-west', name: 'Office' },
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			scope: {},
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it('propagates an exclusion across a conjoined configured-space list', () => {
		expect(
			service.plan({
				message: 'What is the temperature everywhere except Bedroom and Kitchen?',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				conversationSpaceId: 'space-office',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			scope: {},
			ambiguityRisk: 'read',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it('routes an explicit clock-time range to bounded history retrieval', () => {
		expect(
			service.plan({
				message: 'Show the Bedroom temperature from 8am to 10am',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home', 'history'],
			scope: { spaceId: 'space-bedroom' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'property-timeseries', spaceId: 'space-bedroom' },
			],
			strategy: 'prefetch',
		});
	});

	it('routes a since-clock interval to bounded history retrieval', () => {
		expect(
			service.plan({
				message: 'What has the Bedroom temperature been since 8am?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home', 'history'],
			scope: { spaceId: 'space-bedroom' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'property-timeseries', spaceId: 'space-bedroom' },
			],
			strategy: 'prefetch',
		});
	});

	it.each([
		'What was the Bedroom temperature before noon?',
		'What was the Bedroom temperature after 8?',
		'What was the Bedroom temperature until midnight?',
	])('routes a standalone clock bound to bounded history retrieval: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home', 'history'],
			scope: { spaceId: 'space-bedroom' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'property-timeseries', spaceId: 'space-bedroom' },
			],
			strategy: 'prefetch',
		});
	});

	it('keeps article-free smart-lighting definitions off home retrieval', () => {
		expect(
			service.plan({
				message: 'What is smart lighting?',
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
	});

	it('clarifies a lighting action when one configured name resolves multiple spaces', () => {
		expect(
			service.plan({
				message: 'Turn Office lights off',
				knownSpaces: [
					{ id: 'space-office-east', name: 'Office' },
					{ id: 'space-office-west', name: 'Office' },
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			scope: {},
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it('propagates an exclusion across a conjoined configured-space list', () => {
		expect(
			service.plan({
				message: 'What is the temperature everywhere except Bedroom and Kitchen?',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				conversationSpaceId: 'space-office',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			scope: {},
			ambiguityRisk: 'read',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it('routes an explicit clock-time range to bounded history retrieval', () => {
		expect(
			service.plan({
				message: 'Show the Bedroom temperature from 8am to 10am',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home', 'history'],
			scope: { spaceId: 'space-bedroom' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'property-timeseries', spaceId: 'space-bedroom' },
			],
			strategy: 'prefetch',
		});
	});

	it('keeps article-free smart-lighting definitions off home retrieval', () => {
		expect(
			service.plan({
				message: 'What is smart lighting?',
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
	});

	it('clarifies explicit space scopes beyond the bounded planner limit without query fan-out', () => {
		const knownSpaces = Array.from({ length: 21 }, (_, index) => ({
			id: `space-zone-${index}`,
			name: `Zone ${index}`,
		}));
		const result = service.plan({
			message: `What is the temperature in ${knownSpaces.map((space) => space.name).join(' and ')}?`,
			knownSpaces,
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(result).toMatchObject({
			domains: ['home'],
			scope: {},
			queries: [],
			toolNames: [],
			ambiguityRisk: 'read',
			strategy: 'clarify',
		});
	});

	it.each(['Start bedroom fan', 'Stop bedroom fan', 'Deactivate bedroom fan'])(
		'keeps an explicit device command off the scene-trigger tool path: %s',
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

	it('uses the recent reference kind to separate device and scene start commands', () => {
		const providerCapabilities = { toolCalling: 'reliable' as const, supportsStructuredToolResults: true };

		expect(
			service.plan({
				message: 'Start it',
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-fan',
						name: 'Fan',
						compatibleActionTypes: ['start'],
					},
				],
				providerCapabilities,
			}),
		).toMatchObject({
			intent: 'write',
			toolNames: ['search_home', 'query_home_state', 'control_device'],
		});

		expect(
			service.plan({
				message: 'Start it',
				recentEntityReferences: [
					{
						kind: 'scene',
						id: 'scene-bedtime',
						name: 'Bedtime',
						compatibleActionTypes: ['start'],
					},
				],
				providerCapabilities,
			}),
		).toMatchObject({
			intent: 'trigger',
			toolNames: ['search_home', 'query_home_state', 'run_scene'],
		});
	});

	it('does not classify a numeric thermostat adjustment range as history', () => {
		expect(
			service.plan({
				message: 'Set the Bedroom thermostat from 8 to 10 degrees',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'write',
			scope: { spaceId: 'space-bedroom' },
			queries: [{ kind: 'search-home', spaceId: 'space-bedroom' }],
			strategy: 'deterministic-action',
		});
	});

	it('propagates exclusions across repeated prepositions in a space list', () => {
		expect(
			service.plan({
				message: 'What is the temperature everywhere except in Bedroom and in Kitchen?',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ scope: {}, ambiguityRisk: 'read', strategy: 'clarify', toolNames: [] });
	});

	it('does not add conversation-space current state to an energy and history compound', () => {
		expect(
			service.plan({
				message: 'How much energy did Bedroom use and what was Kitchen temperature yesterday?',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				conversationSpaceId: 'space-office',
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home', 'energy', 'history'],
			queries: [
				{ kind: 'search-home', spaceId: 'space-kitchen' },
				{ kind: 'energy-summary', spaceId: 'space-bedroom' },
				{ kind: 'property-timeseries', spaceId: 'space-kitchen' },
			],
		});
	});

	it.each([
		'Also turn off Bedroom lights',
		'Please also turn off Bedroom lights',
		'Could you also turn off Bedroom lights',
	])('recognizes a leading also action command: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'write',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state', 'control_device', 'set_space_lighting'],
		});
	});

	it('clarifies possessive entity pronouns without a safe recent reference', () => {
		expect(
			service.plan({
				message: 'What is its status?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'read', strategy: 'clarify', toolNames: [] });

		expect(
			service.plan({
				message: 'Are their lights on?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'read', strategy: 'clarify', toolNames: [] });
	});

	it.each(['living   room', 'living-room'])(
		'matches configured space names across normalized separators: %s',
		(spacePhrase) => {
			expect(
				service.plan({
					message: `What is the ${spacePhrase} temperature?`,
					knownSpaces: [{ id: 'space-living-room', name: 'Living Room' }],
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ scope: { spaceId: 'space-living-room' } });
		},
	);

	it.each([
		'What was the Bedroom temperature between 8am and 10am?',
		'What was the Bedroom temperature at 8am?',
		'What was the Bedroom temperature last weekend?',
	])('routes another bounded temporal form to history: %s', (message) => {
		expect(
			service.plan({
				message,
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

	it.each(['What is smart home?', 'What is home automation?', 'What are smart devices?'])(
		'keeps another article-free definition off planner retrieval: %s',
		(message) => {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ domains: ['general'], intent: 'none', queries: [], toolNames: [] });
		},
	);

	it('clarifies plural recent-reference scopes beyond the bounded planner limit', () => {
		const recentEntityReferences = Array.from({ length: 21 }, (_, index) => ({
			kind: 'device' as const,
			id: `device-${index}`,
			name: `Device ${index}`,
			compatibleActionTypes: ['turn'] as const,
		}));

		expect(
			service.plan({
				message: 'Are they on?',
				recentEntityReferences,
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: {},
			queries: [],
			toolNames: [],
			ambiguityRisk: 'read',
			strategy: 'clarify',
		});
	});

	it('keeps unit-bearing numeric value ranges on current-state retrieval', () => {
		expect(
			service.plan({
				message: 'Show thermostats set from 18 to 20 degrees',
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
			strategy: 'prefetch',
		});
	});

	it('preserves bounded home retrieval for a device-specific energy read', () => {
		expect(
			service.plan({
				message: 'What is the power usage of the heater?',
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home', 'energy'],
			intent: 'read',
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }, { kind: 'energy-summary' }],
			strategy: 'prefetch',
		});
	});

	it('retains both whole-home and scoped energy queries in one compound', () => {
		expect(
			service.plan({
				message: 'How much energy did the house use, and how much energy did Bedroom use?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['energy'],
			queries: [{ kind: 'energy-summary' }, { kind: 'energy-summary', spaceId: 'space-bedroom' }],
			strategy: 'prefetch',
		});
	});

	it('propagates an energy request across conjoined configured spaces', () => {
		expect(
			service.plan({
				message: 'How much energy did Bedroom and Kitchen use today?',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['energy'],
			scope: { spaceIds: ['space-bedroom', 'space-kitchen'] },
			queries: [
				{ kind: 'energy-summary', spaceId: 'space-bedroom' },
				{ kind: 'energy-summary', spaceId: 'space-kitchen' },
			],
			strategy: 'prefetch',
		});
	});

	it('keeps a complete historical energy clause separate from a following current-state clause', () => {
		expect(
			service.plan({
				message: 'How much energy did Bedroom use yesterday, and what is Kitchen temperature now?',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home', 'energy'],
			scope: { spaceIds: ['space-bedroom', 'space-kitchen'] },
			queries: [
				{ kind: 'search-home', spaceId: 'space-kitchen' },
				{ kind: 'current-state', spaceId: 'space-kitchen' },
				{ kind: 'energy-summary', spaceId: 'space-bedroom' },
			],
			strategy: 'prefetch',
		});
	});

	it('associates a leading temporal adjunct with the following home-state clause', () => {
		expect(
			service.plan({
				message: 'Yesterday, what was the Bedroom temperature?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home', 'history'],
			scope: { spaceId: 'space-bedroom' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'property-timeseries', spaceId: 'space-bedroom' },
			],
			strategy: 'prefetch',
		});
	});

	it('masks only the configured-space occurrence of a repeated domain word', () => {
		expect(
			service.plan({
				message: 'How much energy did Energy use today?',
				knownSpaces: [{ id: 'space-energy', name: 'Energy' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['energy'],
			scope: { spaceId: 'space-energy' },
			queries: [{ kind: 'energy-summary', spaceId: 'space-energy' }],
			strategy: 'prefetch',
		});
	});

	it.each(['Turn some Bedroom lights off', 'Turn two Bedroom lights off'])(
		'clarifies a partial scoped lighting group: %s',
		(message) => {
			expect(
				service.plan({
					message,
					knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({
				domains: ['home'],
				ambiguityRisk: 'action',
				strategy: 'clarify',
				toolNames: [],
			});
		},
	);

	it.each([
		'What was the Bedroom temperature at noon?',
		'What was the Bedroom temperature at midnight?',
		'What was the Bedroom temperature at 8?',
	])('routes a named clock period to history: %s', (message) => {
		expect(
			service.plan({
				message,
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
});
