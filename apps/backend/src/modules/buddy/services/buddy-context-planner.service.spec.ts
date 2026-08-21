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
			const toolCalling = testCase.providerProfile;
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

	it.each([
		'Was Bedroom power off yesterday while Kitchen used energy?',
		'Was Bedroom power off yesterday while Kitchen power usage was high?',
	])('keeps historical power state separate from an energy condition: %s', (message) => {
		const plan = service.plan({
			message,
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-kitchen', name: 'Kitchen' },
			],
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(plan.queries).toContainEqual({ kind: 'property-timeseries', spaceId: 'space-bedroom' });
		expect(plan.queries).toContainEqual({ kind: 'energy-summary', spaceId: 'space-kitchen' });
	});

	it.each([
		'Were Bedroom lights off yesterday while Kitchen window was open?',
		'Was Bedroom fan off yesterday when Kitchen window was open?',
		'Was Bedroom power off yesterday while Kitchen power was on?',
		'Were Bedroom lights off yesterday while Kitchen window remained open?',
		'Were Bedroom lights off yesterday while Kitchen lights stayed on?',
		'Was Bedroom fan off yesterday when Kitchen light turned on?',
	])('inherits the historical range for a past home-state condition: %s', (message) => {
		const plan = service.plan({
			message,
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-kitchen', name: 'Kitchen' },
			],
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(plan.queries).toContainEqual({ kind: 'property-timeseries', spaceId: 'space-bedroom' });
		expect(plan.queries).toContainEqual({ kind: 'property-timeseries', spaceId: 'space-kitchen' });
	});

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
			toolNames: ['search_home', 'control_device'],
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

	it('retains an unscoped aggregate beside a scoped current-state read', () => {
		expect(
			service.plan({
				message: 'What is the Bedroom temperature and are any windows open?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				conversationSpaceId: 'space-bedroom',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'search-home' },
				{ kind: 'current-state', spaceId: 'space-bedroom' },
				{ kind: 'current-state' },
			],
		});
	});

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
		'Did I run the movie night scene?',
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

	it('uses only metadata search for scene capability discovery', () => {
		expect(
			service.plan({
				message: 'Which scenes can I run?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			intent: 'read',
			strategy: 'model-tools',
			toolNames: ['search_home'],
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
			toolNames: ['search_home', 'run_scene'],
		});
		expect(
			service.plan({ message: 'Turn it off', recentEntityReferences: [device], providerCapabilities }),
		).toMatchObject({
			scope: { referencedEntityIds: ['device-lamp'] },
			ambiguityRisk: 'none',
			strategy: 'model-tools',
			toolNames: ['search_home', 'control_device'],
		});
	});

	it.each(['Is it on?', 'Is that turned on?', 'Is that switched off?'])(
		'uses a unique recent reference for the pronoun-only state read %s',
		(message) => {
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
				domains: ['home'],
				intent: 'read',
				scope: { referencedEntityIds: ['device-reading-lamp'] },
				queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
				strategy: 'model-tools',
			});
		},
	);

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
				message: 'Turn it off and run the movie night scene',
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
		'Run the Bedtime scene and make sure the hallway sensor is triggered',
		'Run the Bedtime scene and ensure the hallway sensor is triggered',
		'Run the Bedtime scene and see whether the hallway sensor is triggered',
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
				message: 'Turn kitchen light off and run the movie night scene',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			intent: 'mixed',
			toolNames: ['search_home', 'control_device', 'run_scene'],
		});
	});

	it('clarifies disjunctive action alternatives instead of selecting one', () => {
		expect(
			service.plan({
				message: 'Run the Movie Night scene or run the Bedtime scene',
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

	it('clarifies a scheduled action that immediate tools cannot preserve', () => {
		expect(
			service.plan({
				message: 'Turn the Bedroom lights on at 8pm',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'write',
			scope: { spaceId: 'space-bedroom' },
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
		'clarifies an unsupported future-condition action: %s',
		(message) => {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ ambiguityRisk: 'action', intent: 'mixed', strategy: 'clarify', toolNames: [] });
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
		'Only turn Bedroom lights off if Kitchen lights are on',
		'Please only turn Bedroom lights off if Kitchen lights are on',
		'Can you only turn Bedroom lights off if Kitchen lights are on',
		'If Kitchen lights are on, only turn Bedroom lights off',
	])('recognizes an only-qualified conditional action: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'mixed',
			scope: { spaceId: 'space-bedroom' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'search-home', spaceId: 'space-kitchen' },
				{ kind: 'current-state', spaceId: 'space-kitchen' },
			],
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
				message: 'Nastav ho a spusť scénu Movie Night',
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
			toolNames: ['search_home', 'control_device', 'run_scene'],
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
				message: 'Turn Bedroom desk lamp on and turn living room air handler on',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-living-room', name: 'Living room' },
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			strategy: 'model-tools',
			toolNames: ['search_home', 'control_device'],
		});
	});

	it('classifies a scene run independently from a later device-run target', () => {
		expect(
			service.plan({
				message: 'Run the movie night scene then turn bedroom air handler on',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'mixed',
			strategy: 'model-tools',
			toolNames: ['search_home', 'control_device', 'run_scene'],
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
				toolNames: ['search_home', 'control_device'],
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
			toolNames: ['search_home', 'control_device'],
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

	it('preserves weather retrieval while clarifying a future outside-light condition', () => {
		expect(
			service.plan({
				message: 'Turn on the outside light when it is raining',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home', 'weather'],
			intent: 'mixed',
			queries: [{ kind: 'search-home' }, { kind: 'weather' }],
			strategy: 'clarify',
			toolNames: [],
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
				{ kind: 'search-home' },
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
			toolNames: ['search_home', 'control_device', 'set_space_lighting'],
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

	it('binds postfix temporal qualifiers to their preceding space properties', () => {
		expect(
			service.plan({
				message: 'Compare the Bedroom temperature now with the Kitchen temperature yesterday',
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
				{ kind: 'current-state', spaceId: 'space-bedroom' },
				{ kind: 'property-timeseries', spaceId: 'space-kitchen' },
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

	it('does not restore conversation scope for an action naming an unresolved built-in room', () => {
		const result = service.plan({
			message: 'Set kitchen light to 40%',
			conversationSpaceId: 'space-office',
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(result).toMatchObject({ domains: ['home'], intent: 'write', scope: {} });
		expect(result.queries).toEqual([{ kind: 'search-home' }]);
		expect(result.queries).not.toContainEqual(expect.objectContaining({ spaceId: 'space-office' }));
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

	it('propagates a trailing temporal qualifier across coordinated space properties', () => {
		expect(
			service.plan({
				message: 'What were the Bedroom temperature and Kitchen humidity yesterday?',
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

	it('routes change-over-time questions to property history', () => {
		expect(
			service.plan({
				message: 'How has the Bedroom temperature changed?',
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

	it.each([
		'When did the Bedroom light turn off?',
		'At what time did the Bedroom light turn off?',
		'What was the Bedroom temperature two days ago?',
	])('routes past-tense and word-number history phrasing to timeseries: %s', (message) => {
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
	});

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

	it.each([
		'What was the Bedroom temperature during the previous day?',
		'What was the Bedroom temperature during the previous week?',
		'What was the Bedroom temperature during the previous month?',
		'What was the Bedroom temperature during the previous year?',
	])('routes a previous-period history request to timeseries: %s', (message) => {
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
			service.plan({ message: 'Turn them off', recentEntityReferences: [reference], providerCapabilities }),
		).toMatchObject({
			ambiguityRisk: 'action',
			strategy: 'clarify',
		});
		expect(
			service.plan({ message: 'Are they on?', recentEntityReferences: [reference], providerCapabilities }),
		).toMatchObject({
			ambiguityRisk: 'read',
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
			toolNames: ['search_home', 'control_device', 'set_space_lighting'],
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
			toolNames: ['search_home', 'control_device', 'set_space_lighting'],
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

	it('does not treat capitalization alone as home-state evidence', () => {
		expect(
			service.plan({
				message: 'Is Aurora on?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['general'],
			intent: 'none',
			queries: [],
			strategy: 'no-home-context',
			toolNames: [],
		});
	});

	it('does not treat a conditional state predicate as a second write', () => {
		expect(
			service.plan({
				message: 'Run the Movie Night scene if the window is open',
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
			toolNames: ['search_home', 'control_device'],
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

	it('preserves a demonstrative reference before a target adjective', () => {
		const plan = service.plan({
			message: 'Is that left window open?',
			recentEntityReferences: [
				{
					kind: 'device',
					id: 'device-window',
					name: 'Window',
					compatibleActionTypes: ['open'],
				},
			],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan).toMatchObject({
			domains: ['home'],
			intent: 'read',
			scope: { referencedEntityIds: ['device-window'] },
			ambiguityRisk: 'none',
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

	it('retains an explicit whole-house clause beside a scoped current-state read', () => {
		expect(
			service.plan({
				message: 'What is the Bedroom temperature and what lights are on throughout the house?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home'],
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'search-home' },
				{ kind: 'current-state', spaceId: 'space-bedroom' },
				{ kind: 'current-state' },
			],
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

	it('keeps a configured Home space scoped inside a mixed weather clause', () => {
		expect(
			service.plan({
				message: 'Compare Home temperature with outside temperature',
				knownSpaces: [{ id: 'space-home', name: 'Home' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home', 'weather'],
			scope: { spaceId: 'space-home' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-home' },
				{ kind: 'current-state', spaceId: 'space-home' },
				{ kind: 'weather' },
			],
		});
	});

	it('keeps a domain word inside a scene name on the action path', () => {
		expect(
			service.plan({
				message: 'Run the Security Night scene',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'trigger',
			strategy: 'model-tools',
			toolNames: ['search_home', 'run_scene'],
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
		'Pokud je okno otevřené, zapni světlo Aurora',
		'Když je okno otevřené, zapni světlo Aurora',
		'Jakmile je otevřené, zapni světlo Aurora',
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
			strategy: 'clarify',
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

	it('does not infer a custom home target from a possessive capitalized label', () => {
		expect(
			service.plan({
				message: "What is Aurora's status?",
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['general'],
			intent: 'none',
			queries: [],
			strategy: 'no-home-context',
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

	it.each([
		'Turn all Bedroom lights on apart from the bedside lamp',
		'Turn all Bedroom lights on save the bedside lamp',
		'Turn all Bedroom lights on save for the bedside lamp',
		'Turn all Bedroom lights on with the exception of the bedside lamp',
		'Turn all Bedroom lights on with exception of the bedside lamp',
	])('clarifies another lighting exclusion: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
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

	it.each(['Living Room', 'Living-Room'])(
		'clarifies separator-equivalent configured space names: %s',
		(messageSpaceName) => {
			expect(
				service.plan({
					message: `Turn ${messageSpaceName} lights off`,
					knownSpaces: [
						{ id: 'space-living-room-east', name: 'Living Room' },
						{ id: 'space-living-room-west', name: 'Living-Room' },
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
		},
	);

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
				toolNames: ['search_home', 'control_device'],
			});
		},
	);

	it.each(['Start a timer', 'Stop talking'])(
		'keeps a target-free generic verb off the home action path: %s',
		(message) => {
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
		},
	);

	it('clarifies a negated conditional action without exposing positive action tools', () => {
		expect(
			service.plan({
				message: 'If the window is open, do not turn Bedroom lights on',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
	});

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
			toolNames: ['search_home', 'control_device'],
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
			toolNames: ['search_home', 'run_scene'],
		});
	});

	it.each([
		'Set the Bedroom thermostat from 8 to 10 degrees',
		'Set the Bedroom thermostat between 18 and 22 degrees',
		'Set the Bedroom thermostat to 20-22 degrees',
		'Set the Bedroom thermostat below 20 degrees',
	])('clarifies a numeric thermostat range before scalar control handoff: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'write',
			scope: { spaceId: 'space-bedroom' },
			queries: [{ kind: 'search-home', spaceId: 'space-bedroom' }],
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it.each([
		{ toolCalling: 'reliable' as const, supportsStructuredToolResults: true },
		{ toolCalling: 'unsupported' as const, supportsStructuredToolResults: false },
	])(
		'clarifies a value-dependent command without a target value for $toolCalling providers',
		(providerCapabilities) => {
			for (const message of [
				'Set the Bedroom thermostat',
				'Change the Bedroom thermostat',
				'Adjust the Bedroom thermostat',
				'Make the Bedroom lights',
				'Turn the Bedroom lights',
				'Switch the Bedroom lights',
			]) {
				expect(
					service.plan({
						message,
						knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
						providerCapabilities,
					}),
				).toMatchObject({ intent: 'write', ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
			}

			expect(
				service.plan({
					message: 'Set the coffee maker',
					providerCapabilities,
				}),
			).toMatchObject({ intent: 'write', ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
		},
	);

	it.each([
		'Change the Bedroom thermostat to 20 degrees',
		'Adjust the Bedroom thermostat by 2 degrees',
		'Adjust the Bedroom thermostat up',
		'Make Bedroom lights blue',
	])('retains a complete value-dependent action: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'none', strategy: 'model-tools' });
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
			toolNames: ['search_home', 'control_device', 'set_space_lighting'],
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

	it.each(["kid's room", 'kid’s room'])('matches a configured apostrophe-bearing space name: %s', (spacePhrase) => {
		const result = service.plan({
			message: `What is the temperature in ${spacePhrase}?`,
			knownSpaces: [{ id: 'space-kids-room', name: "Kid's Room" }],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(result).toMatchObject({ scope: { spaceId: 'space-kids-room' } });
		expect(result.queries).toContainEqual({ kind: 'current-state', spaceId: 'space-kids-room' });
	});

	it.each(['💡', '---'])('ignores a configured space name without searchable tokens: %s', (spaceName) => {
		expect(
			service.plan({
				message: 'What is the temperature?',
				knownSpaces: [{ id: 'space-symbol', name: spaceName }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: {},
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
		});
	});

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

	it.each([
		'Could you power off the Bedroom lights?',
		'Power on the Bedroom lights',
		'Power the Bedroom lights off',
		'Power Bedroom lights on',
		'Power on the Bedroom lights please',
		'Power the lights in Bedroom off',
		'Power all lights in Bedroom off',
		'Power on the lights in Bedroom',
	])('recognizes a power action instead of an energy read: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'write',
			scope: { spaceId: 'space-bedroom' },
			queries: [{ kind: 'search-home', spaceId: 'space-bedroom' }],
			ambiguityRisk: 'none',
			strategy: 'model-tools',
			toolNames: ['search_home', 'control_device', 'set_space_lighting'],
		});
	});

	it.each(['Power Bedroom TV off', 'Power the Bedroom television off', 'Power Bedroom air purifier off'])(
		'routes an arbitrary power target through bounded device discovery: %s',
		(message) => {
			const plan = service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			});

			expect(plan.intent).toBe('write');
			expect(plan.ambiguityRisk).toBe('none');
			expect(plan.toolNames).toContain('control_device');
		},
	);

	it('clarifies a preposition-scoped power target before exposing action tools', () => {
		expect(
			service.plan({
				message: 'Power the fan in the Bedroom off',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
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

	it('maps a pronoun power action to turn semantics', () => {
		expect(
			service.plan({
				message: 'Power it off',
				recentEntityReferences: [
					{
						kind: 'property',
						id: 'property-bedroom-light',
						name: 'Bedroom light',
						spaceId: 'space-bedroom',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'write',
			scope: { referencedEntityIds: ['property-bedroom-light'] },
			ambiguityRisk: 'none',
			strategy: 'model-tools',
			toolNames: ['search_home', 'control_device'],
		});
	});

	it.each([
		'Power on it is unstable',
		'Power off it was unexpected',
		'Power it on is impossible',
		'Power it off was accidental',
	])('never treats a pronoun power-state fragment as a command: %s', (message) => {
		const plan = service.plan({
			message,
			recentEntityReferences: [
				{
					kind: 'property',
					id: 'property-bedroom-light',
					name: 'Bedroom light',
					spaceId: 'space-bedroom',
					compatibleActionTypes: ['turn'],
				},
			],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan.toolNames).not.toContain('control_device');
		expect(plan.toolNames).not.toContain('set_space_lighting');
	});

	it.each(['How much power did Bedroom use?', 'What is Bedroom power usage?', 'Show Bedroom power consumption'])(
		'keeps an ordinary power question on energy retrieval: %s',
		(message) => {
			expect(
				service.plan({
					message,
					knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
					providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
				}),
			).toMatchObject({
				domains: ['energy'],
				intent: 'read',
				queries: [{ kind: 'energy-summary', spaceId: 'space-bedroom' }],
				strategy: 'prefetch',
			});
		},
	);

	it.each([
		'How much power do the Bedroom lights use when off?',
		'How much power did the Bedroom lights use while off?',
		'Power usage in Bedroom when lights are off',
		'Compare the power Bedroom lights use on and off',
		'How much power Bedroom lights use when off?',
		'Show power Bedroom lights use when on',
		'Report power Bedroom fans consume while off',
	])('retains energy retrieval for a state-qualified power read: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home', 'energy'],
			intent: 'read',
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'current-state', spaceId: 'space-bedroom' },
				{ kind: 'energy-summary', spaceId: 'space-bedroom' },
			],
		});
	});

	it.each([
		'Why did Bedroom fan power go off?',
		'Could Bedroom fan power be off?',
		'Bedroom fan power is on',
		'Kitchen switch power was off',
		'Can you check whether Bedroom power is on?',
		'Could you tell me whether Bedroom power is off?',
		'Compare whether Bedroom power is on and Kitchen power is off',
		'Compare Bedroom power on with Kitchen power off',
		'Is power to Bedroom lights on?',
		'Is the power for Bedroom lights on?',
	])('keeps a device power-state predicate on home current-state retrieval: %s', (message) => {
		const plan = service.plan({
			message,
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-kitchen', name: 'Kitchen' },
			],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan).toMatchObject({
			domains: ['home'],
			intent: 'read',
		});
		expect(plan.queries.some((query) => query.kind === 'current-state')).toBe(true);
	});

	it.each([
		'Power Bedroom fan is on',
		'Power Kitchen switch was off',
		'Power Bedroom lamp remains on',
		'Power Kitchen heater stays off',
		'Power Bedroom fan appears on',
		'Power Kitchen switch looks off',
		'Power Bedroom lamp currently on',
		'Power Kitchen heater should be off',
		'Power Bedroom fan has been on',
		'Power Kitchen switch turned off',
		'Power on Bedroom fan is unstable',
		'Power off Kitchen fan was unexpected',
		'Power on Bedroom fan status',
		'Power off Kitchen fan report',
		'Power not Bedroom fan on',
	])('never treats a declarative power state as a command: %s', (message) => {
		const plan = service.plan({
			message,
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-kitchen', name: 'Kitchen' },
			],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan.intent).toBe('read');
		expect(plan.toolNames).not.toContain('control_device');
		expect(plan.toolNames).not.toContain('set_space_lighting');
	});

	it.each([
		'Power switches can turn Bedroom lights on',
		'Power outage shut Bedroom lights off',
		'Power failure left Bedroom lights off',
		'Power surge knocked Bedroom lights off',
		'Power restoration brought Bedroom lights on',
		'Power surge set Bedroom lights off',
		'Power cut sent Bedroom lights off',
		'Power recovery put Bedroom lights on',
		'Power availability keeps Bedroom lights on',
		'Power backup leaves Bedroom lights on',
		'Power fault caused Bedroom lights off',
		'Power interruption sent Bedroom lights off',
		'Power loss sent Bedroom lights off',
		'Power blackout put Bedroom lights off',
		'Power brownout sent Bedroom lights off',
		'Power issue caused Bedroom lights off',
		'Power problem set Bedroom lights off',
		'Power spike pushed Bedroom lights off',
		'Power grid put Bedroom lights on',
		'Power interruption sent bedside lamp off',
		'Power loss sent power switch off',
		'Power switch fault keeps Bedroom lights off',
		'Power switch failure leaves Bedroom lights off',
		'Power switch malfunction sends Bedroom lights off',
		'Power heater failure leaves Bedroom lights off',
		'Power switch failure sent bedside lamp off',
		'Power bedside lamp failure leaves Bedroom lights off',
		'Power outdoor light failure leaves Bedroom lights off',
		'Power power switch failure leaves Bedroom lights off',
		'Power air purifier failure leaves Bedroom lights off',
		'Power coffee maker failure leaves Bedroom lights off',
		'Power robot vacuum failure leaves Bedroom lights off',
		'Power Bedroom fan failure leaves Kitchen lights off',
		'Power office heater failure leaves Bedroom lights off',
		'Power security sensor fault keeps Bedroom lights off',
	])('never treats a declarative power event as a command: %s', (message) => {
		const plan = service.plan({
			message,
			knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan.toolNames).not.toContain('control_device');
		expect(plan.toolNames).not.toContain('set_space_lighting');
		if (plan.ambiguityRisk === 'action') {
			expect(plan).toMatchObject({ strategy: 'clarify', toolNames: [] });
		} else {
			expect(plan.intent).toBe('read');
		}
	});

	it.each(['Power bedside lamp off', 'Power power switch off', 'Power switch off', 'Power heater off'])(
		'keeps a direct trusted unscoped power command actionable: %s',
		(message) => {
			const plan = service.plan({
				message,
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			});

			expect(plan).toMatchObject({
				intent: 'write',
				ambiguityRisk: 'none',
				strategy: 'model-tools',
			});
			expect(plan.toolNames).toContain('control_device');
		},
	);

	it.each([
		'Power draw for Bedroom lights on versus off',
		'Power consumed by Bedroom lights on versus off',
		'Power produced by Bedroom lights on versus off',
	])('never treats a power measurement shorthand as a command: %s', (message) => {
		const plan = service.plan({
			message,
			knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan.domains).toContain('energy');
		expect(plan.intent).toBe('read');
		expect(plan.toolNames).not.toContain('control_device');
		expect(plan.toolNames).not.toContain('set_space_lighting');
	});

	it.each([
		'Is Bedroom power on, and show Kitchen temperature',
		'How much energy did Kitchen use, and is Bedroom power on?',
		'Is Bedroom power on, and how much energy did Kitchen use?',
		'Is Bedroom power on when Kitchen energy usage is high?',
		'Is Bedroom power on while Kitchen power usage is low?',
	])('keeps power-state and energy scopes separate in a compound: %s', (message) => {
		const plan = service.plan({
			message,
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-kitchen', name: 'Kitchen' },
			],
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(plan.queries).toContainEqual({ kind: 'current-state', spaceId: 'space-bedroom' });
		expect(plan.queries).not.toContainEqual({ kind: 'energy-summary', spaceId: 'space-bedroom' });
		if (/\b(?:energy|usage)\b/u.test(message)) {
			expect(plan.queries).toContainEqual({ kind: 'energy-summary', spaceId: 'space-kitchen' });
		}
	});

	it('does not apply a state-qualifier space to the power-usage scope', () => {
		const plan = service.plan({
			message: 'What is Bedroom power usage when Kitchen lights are off?',
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-kitchen', name: 'Kitchen' },
			],
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(plan.queries).toContainEqual({ kind: 'energy-summary', spaceId: 'space-bedroom' });
		expect(plan.queries).not.toContainEqual({ kind: 'energy-summary', spaceId: 'space-kitchen' });
		expect(plan.queries).toContainEqual({ kind: 'current-state', spaceId: 'space-kitchen' });
	});

	it.each([
		'Compare Bedroom power usage when Kitchen power usage was high',
		'How much power did Bedroom use when Kitchen used power?',
		'How much power did Bedroom use while Kitchen used energy?',
	])('retains both energy scopes when a condition is also an energy read: %s', (message) => {
		const plan = service.plan({
			message,
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-kitchen', name: 'Kitchen' },
			],
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(plan.queries).toContainEqual({ kind: 'energy-summary', spaceId: 'space-bedroom' });
		expect(plan.queries).toContainEqual({ kind: 'energy-summary', spaceId: 'space-kitchen' });
	});

	it('keeps a power-off predicate on the home-state read path', () => {
		expect(
			service.plan({
				message: 'Is the Bedroom power off?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'current-state', spaceId: 'space-bedroom' },
			],
			strategy: 'model-tools',
		});
	});

	it('does not let a later state predicate turn a power summary into an action', () => {
		expect(
			service.plan({
				message: 'How much power did Bedroom use, and are Kitchen lights off?',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home', 'energy'],
			intent: 'read',
			queries: [
				{ kind: 'search-home', spaceId: 'space-kitchen' },
				{ kind: 'current-state', spaceId: 'space-kitchen' },
				{ kind: 'energy-summary', spaceId: 'space-bedroom' },
			],
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

	it('propagates a repeated energy predicate across coordinated configured spaces', () => {
		expect(
			service.plan({
				message: 'How much energy did Bedroom use and Kitchen use today?',
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

	it('masks every repeated syntactic configured-space occurrence', () => {
		expect(
			service.plan({
				message: 'Compare the temperature in Energy with the humidity in Energy',
				knownSpaces: [{ id: 'space-energy', name: 'Energy' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home'],
			scope: { spaceId: 'space-energy' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-energy' },
				{ kind: 'current-state', spaceId: 'space-energy' },
			],
			strategy: 'prefetch',
		});
	});

	it.each(['Turn some Bedroom lights off', 'Turn two Bedroom lights off', 'Turn half the Bedroom lights off'])(
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

	it('clarifies an unsupported repeated scene action', () => {
		expect(
			service.plan({
				message: 'Run the Movie Night scene twice',
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

	it('clarifies a scoped indoor future-temperature request instead of fetching outdoor weather', () => {
		expect(
			service.plan({
				message: 'What will the Bedroom temperature be tomorrow?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
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

	it('recognizes polite gerund device-action requests', () => {
		const providerCapabilities = { toolCalling: 'reliable' as const, supportsStructuredToolResults: true };

		expect(
			service.plan({
				message: 'Would you mind turning off the Bedroom lights?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities,
			}),
		).toMatchObject({
			intent: 'write',
			ambiguityRisk: 'none',
			strategy: 'model-tools',
		});

		expect(
			service.plan({
				message: 'Could you try turning it off?',
				recentEntityReferences: [{ kind: 'device', id: 'device-fan', name: 'Fan', compatibleActionTypes: ['turn'] }],
				providerCapabilities,
			}),
		).toMatchObject({
			intent: 'write',
			scope: { referencedEntityIds: ['device-fan'] },
			ambiguityRisk: 'none',
			strategy: 'model-tools',
		});
	});

	it('treats a percentage after at as an action value rather than a schedule', () => {
		expect(
			service.plan({
				message: 'Set Kitchen Accent at 8%',
				knownSpaces: [{ id: 'space-kitchen', name: 'Kitchen' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			intent: 'write',
			ambiguityRisk: 'none',
			strategy: 'model-tools',
			toolNames: ['search_home', 'control_device'],
		});
	});

	it('routes a Czech yesterday temperature question to property history', () => {
		expect(
			service.plan({
				message: 'Jaká byla teplota v ložnici včera?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Ložnice' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home', 'history'],
			scope: { spaceId: 'space-bedroom' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'property-timeseries', spaceId: 'space-bedroom' },
			],
		});
	});

	it('keeps a first-person conditional action hypothetical on the read path', () => {
		expect(
			service.plan({
				message: 'If I run the Movie Night scene, what happens?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'read',
			ambiguityRisk: 'none',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state'],
		});
	});

	it('treats a thermostat degree value after at as an immediate action value', () => {
		expect(
			service.plan({
				message: 'Set the Bedroom thermostat at 20 degrees',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			intent: 'write',
			ambiguityRisk: 'none',
			strategy: 'model-tools',
			toolNames: ['search_home', 'control_device'],
		});
	});

	it.each(['everywhere', 'in all spaces', 'in each room'])('treats %s as explicit whole-home scope', (scopePhrase) => {
		expect(
			service.plan({
				message: `What is the temperature ${scopePhrase}?`,
				conversationSpaceId: 'space-office',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			scope: {},
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
		});
	});

	it.each([
		'Are any windows open?',
		'Are there any windows open?',
		'Is every window closed?',
		'Is each window closed?',
		'Are none of the windows open?',
		'Does every window remain closed?',
		'Do all windows remain closed?',
		'Do none of the windows remain open?',
		'Does any window appear open?',
		'Does any window look open?',
		'Does any window seem open?',
		'Are any windows still open?',
		'Is every window currently closed?',
		'Are any windows not closed?',
		'Are there any lights that are still on?',
		'Are there any lights that remain on?',
		'Are there any lights which are on?',
		'Are any windows being left open?',
		'Are there any windows that are being left open?',
		'Are any thermostats heating?',
		'Are any humidity sensors high?',
		'Are any humidity sensors low?',
		'Does any window currently appear open?',
		'Are any lights turned on?',
		'Are all lights switched off?',
		'Are any windows now open?',
		'Are any windows right now open?',
		'Is every one of the windows closed?',
		'Is any one of the windows open?',
		'Can you check if any one of the windows is open?',
		'Does every one of my windows remain closed?',
		'Are any windows left open?',
		'Are any fans running?',
		'Is any air purifier running?',
		'Are any air purifiers running?',
		'Are any robot vacuums running?',
		'Are any dehumidifiers on?',
		'Are any humidifiers on?',
		'Are any outdoor lights on?',
		'Are any desk lamps on?',
		'Are any ceiling fans running?',
		'Are any lights powered on?',
		'Are any fans powered off?',
		'Are any sensors triggered?',
		'Do we have all windows open?',
		'Do I have every window open?',
		'Check if every window is closed',
		'Can you check if any windows are open?',
		'Can you check whether any windows are open?',
		'Can you check if all windows are closed?',
		'Can you please check if any windows are open?',
		'Can you check if any open windows remain?',
		'Can you check if any door sensors are active?',
		'Can you check if any window sensors are open?',
		'Can you check if any light switches are on?',
		'Can you check if any light switch is on?',
		'Can you check if any power switch is off?',
		'Can you check if any smart lights are on?',
		'Can you check if any smart switch is on?',
		'Can you check if any motion sensors are active?',
		'Can you check whether any of our windows are open?',
		'Can you tell me whether there are any windows open?',
		'Could you tell me if any doors are unlocked?',
		'Check whether any windows are open',
		'Please check whether any windows are open',
		'Please check whether any unlocked doors remain',
		'Tell me whether any windows are open',
		'Are there windows open anywhere?',
		'Are there windows open in any room?',
		'Is there any door open?',
		'Do any windows remain open?',
		'Do we have any windows open?',
		'Do I have any doors open?',
		'Are all doors closed?',
		'How many lights are on?',
	])('treats an unscoped aggregate as whole-home despite conversation scope: %s', (message) => {
		const plan = service.plan({
			message,
			conversationSpaceId: 'space-office',
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan).toMatchObject({ domains: ['home'], intent: 'read' });
		expect(plan.scope).toEqual({});
		expect(plan.queries).toEqual([{ kind: 'search-home' }, { kind: 'current-state' }]);
	});

	it.each([
		'Can you check if any windows are open in Bedroom?',
		'Check if every window is closed in Bedroom?',
		'Are none of the windows open in Bedroom?',
		'Are any Bedroom lights on?',
	])('keeps a locally qualified aggregate read scoped: %s', (message) => {
		expect(
			service.plan({
				message,
				conversationSpaceId: 'space-office',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { spaceId: 'space-bedroom' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'current-state', spaceId: 'space-bedroom' },
			],
		});
	});

	it.each([
		'Can you check if any windows are open in here?',
		'Check if every window is closed in here?',
		'Are none of the windows open in here?',
		'Can you check if the windows are open?',
	])('keeps an ordinary wrapped read in the conversation space: %s', (message) => {
		expect(
			service.plan({
				message,
				conversationSpaceId: 'space-office',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { spaceId: 'space-office' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-office' },
				{ kind: 'current-state', spaceId: 'space-office' },
			],
		});
	});

	it.each([
		'Is every browser window open?',
		'Can you check if any files are open?',
		'Can you check if any browser tabs are open?',
		'Can you check if any browser windows are open?',
		'Can you check if any car doors are open?',
		'Can you check if any device drivers are active?',
		'Can you check if any active device drivers remain?',
		'Can you check if any Windows services are active?',
		'Can you check if any light processes are on?',
		'Can you check if any support tickets are open?',
		'Can you check whether all tests are passing?',
		'Does every traffic light remain on?',
		'Does every CPU fan remain running?',
	])('does not globalize a wrapped non-home aggregate: %s', (message) => {
		const plan = service.plan({
			message,
			conversationSpaceId: 'space-office',
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan.scope).toEqual({ spaceId: 'space-office' });
		expect(plan.queries).toEqual([
			{ kind: 'search-home', spaceId: 'space-office' },
			{ kind: 'current-state', spaceId: 'space-office' },
		]);
	});

	it.each([
		'Can you check if any open windows remain, and what is the Kitchen temperature?',
		'What is the Kitchen temperature, and can you check if any unlocked doors remain?',
	])('keeps a wrapped whole-home aggregate global beside an explicit read: %s', (message) => {
		const plan = service.plan({
			message,
			conversationSpaceId: 'space-office',
			knownSpaces: [{ id: 'space-kitchen', name: 'Kitchen' }],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan.queries).toHaveLength(4);
		expect(plan.queries).toContainEqual({ kind: 'search-home' });
		expect(plan.queries).toContainEqual({ kind: 'current-state' });
		expect(plan.queries).toContainEqual({ kind: 'search-home', spaceId: 'space-kitchen' });
		expect(plan.queries).toContainEqual({ kind: 'current-state', spaceId: 'space-kitchen' });
		expect(plan.queries).not.toContainEqual({ kind: 'search-home', spaceId: 'space-office' });
		expect(plan.queries).not.toContainEqual({ kind: 'current-state', spaceId: 'space-office' });
	});

	it('keeps a wrapped non-home aggregate locally scoped beside an explicit read', () => {
		const plan = service.plan({
			message: 'Can you check if any browser windows are open, and what is the Kitchen temperature?',
			conversationSpaceId: 'space-office',
			knownSpaces: [{ id: 'space-kitchen', name: 'Kitchen' }],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan.queries).toHaveLength(4);
		expect(plan.queries).toContainEqual({ kind: 'search-home', spaceId: 'space-office' });
		expect(plan.queries).toContainEqual({ kind: 'current-state', spaceId: 'space-office' });
		expect(plan.queries).toContainEqual({ kind: 'search-home', spaceId: 'space-kitchen' });
		expect(plan.queries).toContainEqual({ kind: 'current-state', spaceId: 'space-kitchen' });
		expect(plan.queries).not.toContainEqual({ kind: 'search-home' });
		expect(plan.queries).not.toContainEqual({ kind: 'current-state' });
	});

	it.each(['Are there windows open anywhere in Bedroom?', 'Are there windows open anywhere in the Bedroom?'])(
		'keeps a locally qualified anywhere read scoped: %s',
		(message) => {
			expect(
				service.plan({
					message,
					conversationSpaceId: 'space-office',
					knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({
				scope: { spaceId: 'space-bedroom' },
				queries: [
					{ kind: 'search-home', spaceId: 'space-bedroom' },
					{ kind: 'current-state', spaceId: 'space-bedroom' },
				],
			});
		},
	);

	it('keeps a contextual anywhere read inside the conversation space', () => {
		expect(
			service.plan({
				message: 'Are there windows open anywhere in this room?',
				conversationSpaceId: 'space-office',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { spaceId: 'space-office' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-office' },
				{ kind: 'current-state', spaceId: 'space-office' },
			],
		});
	});

	it('clarifies an anywhere-else exclusion that the planner cannot represent', () => {
		expect(
			service.plan({
				message: 'Are there windows open anywhere else?',
				conversationSpaceId: 'space-bedroom',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: {},
			ambiguityRisk: 'read',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it('clarifies an anywhere-else energy scope that excludes the conversation space', () => {
		expect(
			service.plan({
				message: 'How much energy was used anywhere else today?',
				conversationSpaceId: 'space-bedroom',
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			ambiguityRisk: 'read',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it('treats an unqualified anywhere-at-all read as whole-home', () => {
		expect(
			service.plan({
				message: 'Are there windows open anywhere at all?',
				conversationSpaceId: 'space-bedroom',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: {},
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
		});
	});

	it('keeps a locally qualified anywhere-at-all read scoped', () => {
		expect(
			service.plan({
				message: 'Are there windows open anywhere at all in Bedroom?',
				conversationSpaceId: 'space-office',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { spaceId: 'space-bedroom' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'current-state', spaceId: 'space-bedroom' },
			],
		});
	});

	it.each([
		'Are doors open anywhere, and what is the temperature now?',
		'What is the temperature now, and are doors open anywhere?',
	])('keeps whole-home and conversation-scoped current reads separate: %s', (message) => {
		const plan = service.plan({
			message,
			conversationSpaceId: 'space-bedroom',
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan.queries).toContainEqual({ kind: 'search-home' });
		expect(plan.queries).toContainEqual({ kind: 'current-state' });
		expect(plan.queries).toContainEqual({ kind: 'search-home', spaceId: 'space-bedroom' });
		expect(plan.queries).toContainEqual({ kind: 'current-state', spaceId: 'space-bedroom' });
	});

	it.each([
		'What is the temperature now, and is the Kitchen light on?',
		'Is the Kitchen light on, and what is the temperature now?',
	])('keeps a conversation-default current-state clause beside an explicit sibling: %s', (message) => {
		const plan = service.plan({
			message,
			conversationSpaceId: 'space-bedroom',
			knownSpaces: [{ id: 'space-kitchen', name: 'Kitchen' }],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan.queries).toContainEqual({ kind: 'current-state', spaceId: 'space-bedroom' });
		expect(plan.queries).toContainEqual({ kind: 'current-state', spaceId: 'space-kitchen' });
	});

	it.each([
		'How much energy did we use today, and how much energy did Kitchen use today?',
		'How much energy did Kitchen use today, and how much energy did we use today?',
		'How much energy did we use here, and how much energy did Kitchen use?',
	])('keeps a conversation-default energy clause beside an explicit sibling: %s', (message) => {
		const plan = service.plan({
			message,
			conversationSpaceId: 'space-bedroom',
			knownSpaces: [{ id: 'space-kitchen', name: 'Kitchen' }],
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(plan.queries).toContainEqual({ kind: 'energy-summary', spaceId: 'space-bedroom' });
		expect(plan.queries).toContainEqual({ kind: 'energy-summary', spaceId: 'space-kitchen' });
	});

	it.each([
		'What was the temperature here yesterday, and what was the Kitchen temperature last week?',
		'What was the temperature yesterday, and what was the Kitchen temperature last week?',
	])('keeps a conversation-default history clause beside an explicit sibling: %s', (message) => {
		const plan = service.plan({
			message,
			conversationSpaceId: 'space-bedroom',
			knownSpaces: [{ id: 'space-kitchen', name: 'Kitchen' }],
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(plan.queries).toContainEqual({ kind: 'property-timeseries', spaceId: 'space-bedroom' });
		expect(plan.queries).toContainEqual({ kind: 'property-timeseries', spaceId: 'space-kitchen' });
	});

	it.each([
		'What was the temperature anywhere yesterday, and what was the Bedroom temperature last week?',
		'What was the Bedroom temperature last week, and what was the temperature anywhere yesterday?',
	])('keeps whole-home and explicit history clauses separate: %s', (message) => {
		const plan = service.plan({
			message,
			knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(plan.queries).toContainEqual({ kind: 'property-timeseries' });
		expect(plan.queries).toContainEqual({ kind: 'property-timeseries', spaceId: 'space-bedroom' });
	});

	it.each([
		'Will it rain anywhere else, and what is the Bedroom temperature?',
		'Can I buy this anywhere else, and what is the Bedroom temperature?',
	])('does not apply a non-home anywhere-else phrase to a home read: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			ambiguityRisk: 'none',
		});
	});

	it.each([
		'Are windows open in any of the rooms?',
		'Are windows open in all of the rooms?',
		'What is the temperature in each of the rooms?',
		'What is the temperature in every one of the rooms?',
	])('treats an expanded room quantifier as whole-home scope: %s', (message) => {
		expect(
			service.plan({
				message,
				conversationSpaceId: 'space-bedroom',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: {},
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
		});
	});

	it.each([
		'Turn Bedroom lights on every Monday',
		'Turn Bedroom lights on after 30 seconds',
		'Turn Bedroom lights on for the rest of the night',
		'Turn Bedroom lights on for the remainder of the day',
		'Turn Bedroom lights on for one and a half hours',
		'Turn Bedroom lights on for two and a half hours',
		'Turn Bedroom lights on for one-and-a-half hours',
		'Turn Bedroom lights on for 1 1/2 hours',
		'Turn Bedroom lights on for a quarter of an hour',
		'Turn Bedroom lights on for three quarters of an hour',
		'Turn Bedroom lights on for about two hours',
		'Turn Bedroom lights on for a couple of hours',
		'Turn Bedroom lights on for the whole night',
		'Turn Bedroom lights on throughout the night',
		'Power Bedroom lights off for 10 minutes',
		'Power Bedroom lights off in 10 minutes',
		'Power off Bedroom lights in 10 minutes',
		'Power Bedroom lights off 10 minutes from now',
		'Turn Bedroom lights on all night',
		'Turn Bedroom lights on the entire night',
		'Turn Bedroom lights on the whole night',
		'Turn Bedroom lights on through the night',
		'Turn Bedroom lights on till morning',
		"Turn Bedroom lights on 'til morning",
	])('clarifies an unsupported action schedule: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'write',
			queries: [{ kind: 'search-home', spaceId: 'space-bedroom' }],
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it('does not confuse a compound fractional scalar with an action duration', () => {
		expect(
			service.plan({
				message: 'Set Bedroom lights to one and a half percent',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'write',
			queries: [{ kind: 'search-home', spaceId: 'space-bedroom' }],
			ambiguityRisk: 'none',
			strategy: 'model-tools',
			toolNames: ['search_home', 'control_device', 'set_space_lighting'],
		});
	});

	it.each([
		'Power on Bedroom fan? No, status only',
		'Power on Bedroom fan. No, only check status',
		'Power on Bedroom fan, no action',
		'Power on Bedroom fan, do nothing',
		"Power on Bedroom fan, don't execute",
		'Power on Bedroom fan, just status',
		'Power on Bedroom fan, read only',
		'Power on Bedroom fan, status only',
		'Power on Bedroom fan, cancel that',
		'Power on Bedroom fan. Never mind',
		"Power on Bedroom fan, actually don't",
		'Turn Bedroom fan on? No, status only',
		'Turn Bedroom fan on, no action',
		'Turn Bedroom fan on, cancel that',
		'Turn Bedroom fan on, cancel it',
		'Turn Bedroom fan on, abort',
		'Turn Bedroom fan on, abort that',
		'Turn Bedroom fan on, scratch that',
		'Turn Bedroom fan on, scratch it',
		'Turn Bedroom fan on, disregard that',
		'Turn Bedroom fan on, ignore that',
		'Turn Bedroom fan on, ignore it',
		"Turn Bedroom fan on, actually don't",
		'Turn Bedroom fan on, forget it',
		'Start Bedtime scene? No, status only',
		'Start Bedtime scene, just status',
		'Start Bedtime scene, nevermind',
		'Start Bedtime scene, abort',
		'Start Bedtime scene, scratch that',
		'Turn Bedroom lights on then never mind',
		'Turn Bedroom lights on and never mind',
		'Turn Bedroom lights on and do not execute',
		'Turn Bedroom lights on — never mind',
	])('clarifies an explicit trailing cancellation before exposing actions: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it('preserves a plural lamp target across conjoined configured spaces', () => {
		expect(
			service.plan({
				message: 'Turn Bedroom and Kitchen lamps on',
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
			toolNames: ['search_home', 'control_device', 'set_space_lighting'],
		});
	});

	it('clarifies a duration-limited action without requesting property history', () => {
		expect(
			service.plan({
				message: 'Turn the Bedroom lights on for 10 minutes',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'write',
			queries: [{ kind: 'search-home', spaceId: 'space-bedroom' }],
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it.each([
		{ toolCalling: 'reliable' as const, supportsStructuredToolResults: true },
		{ toolCalling: 'unsupported' as const, supportsStructuredToolResults: false },
	])('validates a duration on a verb-elided action continuation for $toolCalling providers', (providerCapabilities) => {
		expect(
			service.plan({
				message: 'Turn Bedroom lights off and Kitchen lights on for 10 minutes',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities,
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'write',
			scope: { spaceIds: ['space-bedroom', 'space-kitchen'] },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'search-home', spaceId: 'space-kitchen' },
			],
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it('keeps an explicit history question separate from a preceding action', () => {
		expect(
			service.plan({
				message: 'Turn Bedroom lights off and were Kitchen lights on for 10 minutes?',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['home', 'history'],
			intent: 'mixed',
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'search-home', spaceId: 'space-kitchen' },
				{ kind: 'property-timeseries', spaceId: 'space-kitchen' },
			],
		});
	});

	it.each([
		'Turn Bedroom lights off and Kitchen lights on',
		'Turn Bedroom lights off and then Kitchen lights on',
		'Turn Bedroom lights off, and then Kitchen lights on',
	])('retains an immediate verb-elided action continuation: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'write',
			scope: { spaceIds: ['space-bedroom', 'space-kitchen'] },
			ambiguityRisk: 'none',
			strategy: 'model-tools',
		});
	});

	it.each(['as well as', 'and also'])('inherits an action across the established %s connector', (connector) => {
		const plan = service.plan({
			message: `Set Bedroom thermostat to 20 ${connector} Office thermostat to 21`,
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-office', name: 'Office' },
			],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan).toMatchObject({
			domains: ['home'],
			intent: 'write',
			scope: { spaceIds: ['space-bedroom', 'space-office'] },
			ambiguityRisk: 'none',
			strategy: 'model-tools',
		});
		expect(plan.queries).not.toContainEqual({ kind: 'current-state', spaceId: 'space-office' });
	});

	it.each([
		'Turn Bedroom lights off and the Kitchen fan is on',
		'Turn Bedroom lights off, but the Kitchen fan is on',
		'Turn Bedroom lights off; Kitchen fan is on',
		'Turn Bedroom lights off. Kitchen fan is on',
		'Turn Bedroom lights off and Kitchen temperature is 20',
		'Turn Bedroom lights off and Kitchen fan status',
		'Turn Bedroom lights off and Kitchen fan remains on',
		'Turn Bedroom lights off and Kitchen fan stays on',
		'Turn Bedroom lights off and Kitchen fan seems off',
		'Turn Bedroom lights off and Kitchen fan currently on',
		'Turn Bedroom lights off and Kitchen fan still on',
		'Turn Bedroom lights off and Kitchen fan should be on',
	])('does not inherit an action verb into an independent state fragment: %s', (message) => {
		const plan = service.plan({
			message,
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-kitchen', name: 'Kitchen' },
			],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan).toMatchObject({
			intent: 'mixed',
			scope: { spaceId: 'space-bedroom' },
			ambiguityRisk: 'none',
			strategy: 'model-tools',
		});
		expect(plan.queries).toContainEqual({ kind: 'search-home', spaceId: 'space-bedroom' });
		expect(plan.queries).toContainEqual({ kind: 'search-home', spaceId: 'space-kitchen' });
		expect(plan.queries).toContainEqual({ kind: 'current-state', spaceId: 'space-kitchen' });
	});

	it.each([
		{ message: 'Will it rain tomorrow?', spaceName: 'Rain', domains: ['weather'], query: { kind: 'weather' } },
		{
			message: 'What is the weather outside?',
			spaceName: 'Weather',
			domains: ['weather'],
			query: { kind: 'weather' },
		},
		{
			message: 'How much energy did we use today?',
			spaceName: 'Energy',
			domains: ['energy'],
			query: { kind: 'energy-summary' },
		},
		{
			message: 'Is the house security armed?',
			spaceName: 'Security',
			domains: ['security'],
			query: { kind: 'security-status' },
		},
	])('preserves the lexical $spaceName domain word without space syntax', ({ message, spaceName, domains, query }) => {
		const result = service.plan({
			message,
			knownSpaces: [{ id: `space-${spaceName.toLowerCase()}`, name: spaceName }],
			conversationSpaceId: 'space-office',
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(result).toMatchObject({ domains, scope: {}, queries: [query] });
	});

	it.each(['this week', 'this month', 'this year'])(
		'routes a past-tense current-period request to property history: %s',
		(period) => {
			expect(
				service.plan({
					message: `What was the Bedroom temperature ${period}?`,
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
		},
	);

	it('preserves conversation scope beside a separate explicit space', () => {
		expect(
			service.plan({
				message: 'What is the temperature here and the Kitchen humidity?',
				knownSpaces: [{ id: 'space-kitchen', name: 'Kitchen' }],
				conversationSpaceId: 'space-bedroom',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { spaceIds: ['space-bedroom', 'space-kitchen'] },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'search-home', spaceId: 'space-kitchen' },
				{ kind: 'current-state', spaceId: 'space-bedroom' },
				{ kind: 'current-state', spaceId: 'space-kitchen' },
			],
		});
	});

	it('keeps a read clock qualifier out of a coordinated immediate action', () => {
		expect(
			service.plan({
				message: 'What was the Bedroom temperature at 8am, then turn all Kitchen lights off',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			intent: 'mixed',
			ambiguityRisk: 'none',
			strategy: 'deterministic-action',
			toolNames: [],
		});
	});

	it.each(['Turn none of the Bedroom lights on', 'Turn zero Bedroom lights on'])(
		'clarifies a zero-quantity lighting command: %s',
		(message) => {
			expect(
				service.plan({
					message,
					knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({
				ambiguityRisk: 'action',
				strategy: 'clarify',
				toolNames: [],
			});
		},
	);

	it.each(['Home', 'House'])('keeps a configured %s space distinct from whole-home energy', (spaceName) => {
		const spaceId = `space-${spaceName.toLowerCase()}`;

		expect(
			service.plan({
				message: `How much energy did ${spaceName} use today?`,
				knownSpaces: [{ id: spaceId, name: spaceName }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['energy'],
			scope: { spaceId },
			queries: [{ kind: 'energy-summary', spaceId }],
		});
	});

	it('matches punctuation-equivalent configured space names', () => {
		expect(
			service.plan({
				message: 'What is the living room temperature?',
				knownSpaces: [{ id: 'space-living-room', name: 'Living-Room' }],
				conversationSpaceId: 'space-office',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { spaceId: 'space-living-room' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-living-room' },
				{ kind: 'current-state', spaceId: 'space-living-room' },
			],
		});
	});

	it('clarifies room-scoped security status instead of fetching global alerts', () => {
		expect(
			service.plan({
				message: 'Are there security alerts in Bedroom?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['security'],
			scope: { spaceId: 'space-bedroom' },
			ambiguityRisk: 'read',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it.each([
		'If the window is open, don’t turn Bedroom lights on',
		'If the window is open, you must not turn Bedroom lights on',
		'If the window is open, you should not turn Bedroom lights on',
		"If the window is open, you can't turn Bedroom lights on",
		"If the window is open, don't ever turn Bedroom lights on",
		'If the window is open, never ever turn Bedroom lights on',
		'Turn neither Bedroom nor Kitchen lights on',
		'Turn off Bedroom lights, not Kitchen lights',
		'Turn Bedroom rather than Kitchen lights on',
		'Turn Bedroom instead of Kitchen lights on',
		'If the window is open, never, ever turn Bedroom lights on',
		"If the window is open, don't under any circumstances turn Bedroom lights on",
		'If the window is open, you must absolutely not turn Bedroom lights on',
		'If the window is open, do not immediately turn Bedroom lights on',
		'If the window is open, try not to ever turn Bedroom lights on',
		'If the window is open, under no circumstances turn Bedroom lights on',
		'If the window is open, you are not allowed to turn Bedroom lights on',
		'If the window is open, you are forbidden to turn Bedroom lights on',
		'Please do not turn Bedroom lights on',
		'Can you not turn Bedroom lights on?',
		'Never again turn Bedroom lights on',
		'Under no circumstances should you turn Bedroom lights on',
		'I do not want you to turn Bedroom lights on',
		'Avoid turning Bedroom lights on',
		'Refrain from turning Bedroom lights on',
		'Do anything but turn Bedroom lights on',
	])('clarifies a negative or exclusion-bearing action without exposing positive tools: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			ambiguityRisk: 'action',
			strategy: 'clarify',
			toolNames: [],
		});
	});

	it.each(['Stop the Movie Night scene', 'Deactivate the Movie Night scene'])(
		'clarifies an inverse scene command instead of mapping it to run_scene: %s',
		(message) => {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({
				intent: 'trigger',
				ambiguityRisk: 'action',
				strategy: 'clarify',
				toolNames: [],
			});
		},
	);

	it('clarifies an inverse command against a recent scene reference', () => {
		expect(
			service.plan({
				message: 'Stop it',
				recentEntityReferences: [
					{
						kind: 'scene',
						id: 'scene-movie-night',
						name: 'Movie Night',
						compatibleActionTypes: ['stop'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it.each([
		'Open the file',
		'Set a reminder',
		'Turn the page',
		'Change my password',
		'Make a sandwich',
		'Run tests',
		'Open Spotify',
		'Close the app',
		'Switch tabs',
		'Open a document',
		'Run npm',
		'Run payroll',
		'Run the build',
		'Trigger a deployment',
		'Start the dishwasher',
		'Activate Bluetooth',
	])('keeps a generic non-home imperative off the physical tool path: %s', (message) => {
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
	});

	it.each(['Turn the Bedroom screen off', 'Set Bedroom volume to 20', 'Turn Bedroom phone charger off'])(
		'keeps a configured-space custom target on the home action path: %s',
		(message) => {
			expect(
				service.plan({
					message,
					knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ domains: ['home'], intent: 'write', ambiguityRisk: 'none', strategy: 'model-tools' });
		},
	);

	it('does not expose a scene tool for an arbitrary named start target without typed evidence', () => {
		expect(
			service.plan({
				message: 'Start Relax Mode',
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

	it.each([
		'Turn Bedroom lights on later',
		'Turn Bedroom lights on this evening',
		'Turn Bedroom lights on next Monday',
		'Turn Bedroom lights on at sunset',
		'Turn Bedroom lights on after sunset',
		'Whenever I arrive, turn Bedroom lights on',
		'Every time I arrive, turn Bedroom lights on',
		'When I get home, turn Bedroom lights on',
		'Turn Bedroom lights on each time I arrive',
		'Turn Bedroom lights on on weekdays',
		'Turn Bedroom lights on in fifteen minutes',
		'Turn Bedroom lights on in half an hour',
		'Turn Bedroom lights on for half an hour',
		'Turn Bedroom lights on for an hour',
		'Turn Bedroom lights on for the next 10 minutes',
		'Turn Bedroom lights on for next ten minutes',
		'Turn Bedroom lights on for 90 mins',
		'Turn Bedroom lights on for 1.5 hours',
		'Turn Bedroom lights on for the next 1.5 hrs',
		'Turn Bedroom lights on for 30 secs',
		'Turn Bedroom lights on for 2 hrs',
		'Turn Bedroom lights on in 30 mins',
		'Turn Bedroom lights on next month',
		'Turn Bedroom lights on this weekend',
		'Turn Bedroom lights on at dawn',
		'Turn Bedroom lights on at dusk',
		'Turn Bedroom lights on every other day',
		'Monday, turn Bedroom lights on',
		'At dawn, turn Bedroom lights on',
		'Turn Bedroom lights on when I leave',
		'Turn Bedroom lights on in a little while',
		'Turn Bedroom lights on soon',
		'Turn Bedroom lights on in twenty minutes',
		'Turn Bedroom lights on in a quarter hour',
		'Turn Bedroom lights on in 1.5 hours',
		'Turn Bedroom lights on next year',
		'Turn Bedroom lights on this month',
		'Turn Bedroom lights on after dinner',
		'Turn Bedroom lights on when I wake up',
		'Turn Bedroom lights on two months from now',
		'When I leave, turn Bedroom lights off',
		'When motion is detected, turn Bedroom lights on',
		'Turn Bedroom lights on at seven',
		'Turn Bedroom lights on after work',
		'Turn Bedroom lights on before dinner',
		'Turn Bedroom lights on once I arrive',
		'Turn Bedroom lights on within 20 minutes',
		'Turn Bedroom lights on every two days',
		'Turn Bedroom lights on on August 25',
		'Turn Bedroom lights on after I leave',
		'Before sunset, turn Bedroom lights on',
		'As soon as I arrive, turn Bedroom lights on',
		'Turn Bedroom lights on at the end of the day',
		'Turn Bedroom lights on at bedtime',
		'Turn Bedroom lights on when everyone leaves',
		'Turn Bedroom lights on until 10pm',
		'Turn Bedroom lights on after the meeting',
		'Turn Bedroom lights on at quarter past seven',
		'Turn Bedroom lights on upon arrival',
		'Turn Bedroom lights on by seven',
		'Turn Bedroom lights on fortnightly',
		'Turn Bedroom lights on monthly',
		'Turn Bedroom lights on annually',
		'Turn Bedroom lights on each two days',
	])('clarifies a future or recurring action instead of executing it immediately: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it.each([
		'Set Bedroom thermostat at seven degrees',
		'Set Bedroom lights at one percent',
		'Set Bedroom lights at ten percent brightness',
	])('does not mistake a scalar unit for a scheduled action: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'none', strategy: 'model-tools' });
	});

	it.each(['Will Alice run?', 'Is Central Park open?', 'Did Tuesday run late?', 'Does Java run?'])(
		'does not treat a proper noun as home-state evidence: %s',
		(message) => {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ domains: ['general'], intent: 'none', queries: [], toolNames: [] });
		},
	);

	it.each([
		'Is the museum open?',
		'Will the store open?',
		'Can I turn left?',
		'Should I lower my voice?',
		'Does the software run?',
		'Is the file locked?',
		'Are you open?',
	])('keeps a non-home predicate off installation retrieval: %s', (message) => {
		expect(
			service.plan({
				message,
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ domains: ['general'], intent: 'none', queries: [], toolNames: [] });
	});

	it.each([
		'What is kinetic energy?',
		'What is electrical power?',
		'Tell me about energy conservation',
		'What is security?',
		'Explain website security',
		'What is weather?',
		'Define kinetic energy',
		'Explain renewable energy',
		'Tell me about electrical power',
		'Explain home security',
		'Describe weather',
		'What are weather patterns?',
	])('keeps a conceptual domain question off live installation prefetch: %s', (message) => {
		expect(
			service.plan({
				message,
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({ domains: ['general'], intent: 'none', queries: [], toolNames: [] });
	});

	it('clarifies an explicit-space reference without verifiable space identity', () => {
		const missingSpaceIds: readonly (string | null | undefined)[] = [undefined, null];

		for (const spaceId of missingSpaceIds) {
			expect(
				service.plan({
					message: 'Turn it off in Kitchen',
					knownSpaces: [{ id: 'space-kitchen', name: 'Kitchen' }],
					recentEntityReferences: [
						{
							kind: 'device',
							id: 'device-lamp',
							name: 'Lamp',
							spaceId,
							compatibleActionTypes: ['turn'],
						},
					],
					providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
				}),
			).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
		}
	});

	it('clarifies a singular reference combined with multiple explicit spaces', () => {
		expect(
			service.plan({
				message: 'Turn it off in Kitchen and Bedroom',
				knownSpaces: [
					{ id: 'space-kitchen', name: 'Kitchen' },
					{ id: 'space-bedroom', name: 'Bedroom' },
				],
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-lamp',
						name: 'Lamp',
						spaceId: 'space-bedroom',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it('does not treat an inherited conversation space as a hard reference constraint', () => {
		expect(
			service.plan({
				message: 'Turn it off',
				conversationSpaceId: 'space-bedroom',
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-garden-lamp',
						name: 'Garden lamp',
						spaceId: 'space-garden',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({ ambiguityRisk: 'none', strategy: 'deterministic-action' });
	});

	it('retains current-state grounding for a filtered group action', () => {
		expect(
			service.plan({
				message: 'Set Bedroom lights that are on to 40%',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			intent: 'mixed',
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'current-state', spaceId: 'space-bedroom' },
			],
			toolNames: ['search_home', 'query_home_state', 'control_device', 'set_space_lighting'],
		});
	});

	it('retains current-state access beside capability discovery in a compound read', () => {
		expect(
			service.plan({
				message: 'Which lights can I dim, and are any windows open?',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			intent: 'read',
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }],
			toolNames: ['search_home', 'query_home_state'],
		});
	});

	it.each([
		'Turn Bedroom off',
		'Activate Bedroom',
		'Start Bedroom',
		'Open Bedroom',
		'Turn Bedroom completely off',
		'Turn Bedroom back on',
		'Open Bedroom now',
		'Turn Bedroom blue',
		'Set Bedroom to eco mode',
	])('does not treat a configured space by itself as a device target: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it.each([
		'Close the browser window',
		'Close the terminal window',
		'Turn the page light off',
		'Open a new window',
		'Open new window',
		'Open another window',
		'Close the car door',
		'Turn the page lamp on',
		'Open the browser door',
		'Open Chrome window',
		'Close the application window',
	])('does not expose a physical tool for a clearly non-home modified device noun: %s', (message) => {
		expect(
			service.plan({
				message,
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'none', strategy: 'no-home-context', toolNames: [] });
	});

	it.each([
		'Close the Firefox window',
		'Close the editor window',
		'Open the email window',
		'Open the popup window',
		'Turn the webpage light off',
		'Turn the keyboard light on',
		'Open the airplane door',
	])('clarifies an untyped modified device noun without exposing physical tools: %s', (message) => {
		expect(
			service.plan({
				message,
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it.each([
		'Turn coffee maker off',
		'Turn aquarium pump off',
		'Open the skylight',
		'Turn air purifier on',
		'Start robot vacuum',
		'Stop sprinkler',
		'Activate irrigation',
		'Set media volume to 20',
		'Turn dehumidifier off',
		'Turn my dehumidifier off',
		'Turn my espresso machine off',
		'Turn my pool pump off',
		'Set my humidifier to 40%',
		'Run Bedtime',
		'Start Roomba',
		'Turn Aurora on',
	])('routes an unresolved custom target to clarification without physical tools: %s', (message) => {
		expect(
			service.plan({
				message,
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it.each(['Turn Bedroom lights off and trigger Dinner', 'Run movie night and turn Bedroom lights off'])(
		'clarifies a compound when any action clause lacks typed target evidence: %s',
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

	it.each(['Run Kitchen scene and turn Bedroom lights off', 'Turn Bedroom lights off and run Kitchen scene'])(
		'keeps generic-target ambiguity local to each action clause: %s',
		(message) => {
			expect(
				service.plan({
					message,
					knownSpaces: [
						{ id: 'space-kitchen', name: 'Kitchen' },
						{ id: 'space-bedroom', name: 'Bedroom' },
					],
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
		},
	);

	it('keeps an independent unscoped state read global beside a scoped action', () => {
		expect(
			service.plan({
				message: 'Turn Bedroom lights off and are any windows open?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			queries: [{ kind: 'search-home' }, { kind: 'search-home', spaceId: 'space-bedroom' }, { kind: 'current-state' }],
		});
	});

	it('keeps unscoped capability discovery global without adding current state to an absolute action', () => {
		expect(
			service.plan({
				message: 'Which scenes can I run, and turn Bedroom lights off',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			queries: [{ kind: 'search-home' }, { kind: 'search-home', spaceId: 'space-bedroom' }],
			toolNames: ['search_home', 'control_device', 'set_space_lighting'],
		});
	});

	it('uses only the independent read space for current state beside an absolute action', () => {
		expect(
			service.plan({
				message: 'Turn Bedroom lights off and what is the Kitchen temperature?',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'search-home', spaceId: 'space-kitchen' },
				{ kind: 'current-state', spaceId: 'space-kitchen' },
			],
		});
	});

	it('retains a comparison read after a resolved reference action', () => {
		expect(
			service.plan({
				message: 'Turn it off and compare Kitchen and Office temperature',
				knownSpaces: [
					{ id: 'space-kitchen', name: 'Kitchen' },
					{ id: 'space-office', name: 'Office' },
				],
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-bedroom-lamp',
						name: 'Bedroom lamp',
						spaceId: 'space-bedroom',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			intent: 'mixed',
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'search-home', spaceId: 'space-kitchen' },
				{ kind: 'search-home', spaceId: 'space-office' },
				{ kind: 'current-state', spaceId: 'space-kitchen' },
				{ kind: 'current-state', spaceId: 'space-office' },
			],
			toolNames: ['search_home', 'query_home_state', 'control_device'],
		});
	});

	it('does not apply a read-clause space to a resolved reference action', () => {
		const result = service.plan({
			message: 'Turn it off and what is the Kitchen temperature?',
			knownSpaces: [{ id: 'space-kitchen', name: 'Kitchen' }],
			recentEntityReferences: [
				{
					kind: 'device',
					id: 'device-bedroom-lamp',
					name: 'Bedroom lamp',
					spaceId: 'space-bedroom',
					compatibleActionTypes: ['turn'],
				},
			],
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(result).toMatchObject({
			ambiguityRisk: 'none',
			strategy: 'deterministic-action',
			scope: { referencedEntityIds: ['device-bedroom-lamp'] },
		});
		expect(result.scope).not.toHaveProperty('spaceId');
	});

	it.each([
		'Turn Bedroom lights on if the window is not open',
		'Turn Bedroom lights on if the fan does not run',
		'Turn Bedroom lights on if the door cannot open',
		'Turn Bedroom lights on if the alarm cannot activate',
		'Turn Bedroom lights on if the scene will not run',
		'Turn Bedroom lights on if the thermostat should not change',
		'If the window is open, but the door is not locked, turn Bedroom lights on',
		'If the window is not open turn Bedroom lights on',
	])('does not confuse a negated condition with a negated action: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'none' });
	});

	it('checks a resolved reference only against the explicit space in its own action clause', () => {
		expect(
			service.plan({
				message: 'Turn it off and turn Kitchen lights on',
				knownSpaces: [{ id: 'space-kitchen', name: 'Kitchen' }],
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-bedroom-lamp',
						name: 'Bedroom lamp',
						spaceId: 'space-bedroom',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'none', strategy: 'model-tools' });
	});

	it('clarifies a recent-reference action whose explicit space contradicts the reference space', () => {
		expect(
			service.plan({
				message: 'Turn it off in Kitchen',
				knownSpaces: [{ id: 'space-kitchen', name: 'Kitchen' }],
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-bedroom-lamp',
						name: 'Bedroom lamp',
						spaceId: 'space-bedroom',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it('clarifies a recent-reference action whose contextual space contradicts the reference space', () => {
		expect(
			service.plan({
				message: 'Turn it off in here',
				conversationSpaceId: 'space-kitchen',
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-bedroom-lamp',
						name: 'Bedroom lamp',
						spaceId: 'space-bedroom',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it('clarifies a space-kind pronoun action that cannot use control_device', () => {
		expect(
			service.plan({
				message: 'Turn it off',
				recentEntityReferences: [
					{
						kind: 'space',
						id: 'space-bedroom',
						name: 'Bedroom',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it.each([
		{
			message: 'What is the Bedroom temperature?',
			expectedStrategy: 'prefetch',
			expectedIntent: 'read',
		},
		{
			message: 'Turn the Bedroom lights off',
			expectedStrategy: 'deterministic-action',
			expectedIntent: 'write',
		},
	])('pins limited-provider planning for $message', ({ message, expectedStrategy, expectedIntent }) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'limited', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ intent: expectedIntent, strategy: expectedStrategy, toolNames: [] });
	});

	it.each([
		'Turn Bedroom lights on by Friday',
		'Turn Bedroom lights on come Monday',
		'Turn Bedroom lights on around 5pm',
		'Turn Bedroom lights on near sunset',
		'Turn Bedroom lights on towards evening',
		'Turn Bedroom lights on eventually',
		'Turn Bedroom lights on sometime',
		'Turn Bedroom lights on in the future',
		'Turn Bedroom lights on next Christmas',
		'Turn Bedroom lights on on Christmas',
		'Turn Bedroom lights on during dinner',
		'Turn Bedroom lights on semiannually',
		'Turn Bedroom lights on biweekly',
		'Turn Bedroom lights on every fortnight',
		'Turn Bedroom lights on at lunchtime',
		'Turn Bedroom lights on following dinner',
	])('clarifies an unsupported natural-language schedule: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it.each([
		'I forbid you to turn Bedroom lights on',
		'No way should you turn Bedroom lights on',
		'You had better not turn Bedroom lights on',
		'Make sure not to turn Bedroom lights on',
	])('never exposes action tools for a prohibition: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it.each(['Open Figma', 'Start Docker', 'Run Jest'])(
		'keeps a known non-home application command out of home tools: %s',
		(message) => {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ domains: ['general'], intent: 'none', strategy: 'no-home-context', toolNames: [] });
		},
	);

	it('does not treat an automotive power window as a trusted home target', () => {
		expect(
			service.plan({
				message: 'Open power window',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it.each(['Run the After Hours scene', 'Run the Once Upon a Time scene', 'Run the Until Dawn scene'])(
		'keeps temporal words inside an explicit scene title: %s',
		(message) => {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ intent: 'trigger', ambiguityRisk: 'none', strategy: 'model-tools' });
		},
	);

	it('keeps a temporal word inside an explicit device title', () => {
		expect(
			service.plan({
				message: 'Turn Before Sunrise lamp on',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ intent: 'write', ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it('keeps energy-only retrieval out of a compound home action plan', () => {
		expect(
			service.plan({
				message: 'Turn Bedroom lights off and how much energy did Kitchen use?',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { spaceId: 'space-bedroom' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'energy-summary', spaceId: 'space-kitchen' },
			],
		});
	});

	it.each([
		'Turn Bedroom lights on if outside temperature is below 10',
		'If outside temperature is below 10, turn Bedroom lights on',
	])('keeps a weather-only condition out of current home state: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { spaceId: 'space-bedroom' },
			queries: [{ kind: 'search-home', spaceId: 'space-bedroom' }, { kind: 'weather' }],
		});
	});

	it('keeps independent security and scoped temperature reads independently scoped', () => {
		expect(
			service.plan({
				message: 'What is the security status and Kitchen temperature?',
				knownSpaces: [{ id: 'space-kitchen', name: 'Kitchen' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			ambiguityRisk: 'none',
			queries: [
				{ kind: 'search-home', spaceId: 'space-kitchen' },
				{ kind: 'current-state', spaceId: 'space-kitchen' },
				{ kind: 'security-status' },
			],
		});
	});

	it.each([
		'Turn Bedroom lights on if Kitchen security is armed',
		'If Kitchen security is armed, turn Bedroom lights on',
		'Turn Bedroom lights off and what is Kitchen security status?',
	])('clarifies a scoped security clause that the global security query cannot represent: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it('keeps a referenced action search separate from an independent read scope', () => {
		expect(
			service.plan({
				message: 'Turn it off and what is the Kitchen temperature?',
				knownSpaces: [{ id: 'space-kitchen', name: 'Kitchen' }],
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-bedroom-lamp',
						name: 'Bedroom lamp',
						spaceId: 'space-bedroom',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { referencedEntityIds: ['device-bedroom-lamp'] },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'search-home', spaceId: 'space-kitchen' },
				{ kind: 'current-state', spaceId: 'space-kitchen' },
			],
		});
	});

	it('deduplicates an explicit and contextual action scope', () => {
		expect(
			service.plan({
				message: 'Turn it off here in Bedroom',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				conversationSpaceId: 'space-bedroom',
				recentEntityReferences: [
					{
						kind: 'device',
						id: 'device-bedroom-lamp',
						name: 'Bedroom lamp',
						spaceId: 'space-bedroom',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			ambiguityRisk: 'none',
			scope: { spaceId: 'space-bedroom', referencedEntityIds: ['device-bedroom-lamp'] },
		});
	});

	it.each([
		'I want you to turn the Bedroom lights off',
		"I'd like you to turn the Bedroom lights off",
		'I need you to turn the Bedroom lights off',
	])('recognizes a declarative action-request prefix: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ intent: 'write', ambiguityRisk: 'none', strategy: 'model-tools' });
	});

	it.each([
		'Turn most of the Bedroom lights off',
		'Turn a majority of the Bedroom lights off',
		'Turn the majority of Bedroom lights off',
		'Turn the majority of the Bedroom lights off',
		'Turn majority of Bedroom lights off',
	])('clarifies a majority-only lighting request: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it.each(['Turn both Bedroom lights on', 'Turn both of Bedroom lights on', 'Turn both of the Bedroom lights on'])(
		'clarifies a both-only lighting request: %s',
		(message) => {
			const plan = service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			});

			expect(plan).toMatchObject({
				domains: ['home'],
				intent: 'write',
				ambiguityRisk: 'action',
				strategy: 'clarify',
			});
			expect(plan.scope).toEqual({ spaceId: 'space-bedroom' });
			expect(plan.queries).toEqual([{ kind: 'search-home', spaceId: 'space-bedroom' }]);
			expect(plan.toolNames).toEqual([]);
		},
	);

	it.each([
		'Turn a pair of Bedroom lights on',
		'Turn either of the Bedroom lights on',
		'Turn either light in Bedroom on',
		'Turn either bedside lamp on',
		'Turn either outdoor light on',
		'Turn either ceiling light on',
		'Turn ten Bedroom lights on',
		'Turn a dozen Bedroom lights on',
		'Turn twenty-one Bedroom lights on',
		'Turn every other Bedroom light off',
		'Turn alternate Bedroom lights off',
	])('clarifies a word-quantity lighting subset: %s', (message) => {
		const plan = service.plan({
			message,
			knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify' });
		expect(plan.toolNames).toEqual([]);
	});

	it.each(['Turn all Bedroom lights on', 'Turn every Bedroom light on'])(
		'keeps an explicit whole lighting group actionable: %s',
		(message) => {
			const plan = service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			});

			expect(plan).toMatchObject({
				ambiguityRisk: 'none',
				strategy: 'model-tools',
			});
			expect(plan.toolNames).toContain('set_space_lighting');
		},
	);

	it.each([
		'Turn both Bedroom and Kitchen lights on',
		'Turn Bedroom and Kitchen lights on',
		'Turn all Bedroom and Kitchen lights on',
		'Turn every Bedroom and Kitchen light on',
	])('keeps explicitly named whole lighting spaces actionable: %s', (message) => {
		const plan = service.plan({
			message,
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-kitchen', name: 'Kitchen' },
			],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan).toMatchObject({ intent: 'write', ambiguityRisk: 'none', strategy: 'model-tools' });
		expect(plan.scope).toEqual({ spaceIds: ['space-bedroom', 'space-kitchen'] });
		expect(plan.toolNames).toContain('set_space_lighting');
	});

	it.each([
		'Turn some Bedroom and Kitchen lights on',
		'Turn half of the Bedroom and Kitchen lights on',
		'Turn three Bedroom and Kitchen lights on',
		'Turn most of the Bedroom and Kitchen lights on',
		'Turn a few Bedroom and Kitchen lights on',
	])('clarifies a partial selection across multiple lighting spaces: %s', (message) => {
		const plan = service.plan({
			message,
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-kitchen', name: 'Kitchen' },
			],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify' });
		expect(plan.toolNames).toEqual([]);
	});

	it('clarifies a conjunction-based negative lighting target', () => {
		expect(
			service.plan({
				message: 'Turn off the Bedroom lights and not the Kitchen lights',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it.each(['Turn a third of the Bedroom lights off', 'Turn a quarter of the Bedroom lights off'])(
		'clarifies an article-based fractional lighting group: %s',
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

	it('preserves a generic definition that resembles a configured space name', () => {
		expect(
			service.plan({
				message: 'What is a bedroom?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
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

	it.each([
		'Turn Bedroom lights off and compare Kitchen and Office temperature',
		'Turn Bedroom lights off and what are Kitchen and Office temperatures?',
	])('keeps a trailing conjoined read out of the action scope: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
					{ id: 'space-office', name: 'Office' },
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { spaceId: 'space-bedroom' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'search-home', spaceId: 'space-kitchen' },
				{ kind: 'search-home', spaceId: 'space-office' },
				{ kind: 'current-state', spaceId: 'space-kitchen' },
				{ kind: 'current-state', spaceId: 'space-office' },
			],
		});
	});

	it('keeps a conjoined energy read out of home-state retrieval', () => {
		expect(
			service.plan({
				message: 'Turn Bedroom lights off and show Kitchen and Office energy usage',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
					{ id: 'space-office', name: 'Office' },
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { spaceId: 'space-bedroom' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'energy-summary', spaceId: 'space-kitchen' },
				{ kind: 'energy-summary', spaceId: 'space-office' },
			],
		});
	});

	it('keeps a three-space conjoined energy read out of home-state retrieval', () => {
		expect(
			service.plan({
				message: 'Turn Bedroom lights off and show Kitchen, Office, and Garage energy usage',
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
					{ id: 'space-office', name: 'Office' },
					{ id: 'space-garage', name: 'Garage' },
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			scope: { spaceId: 'space-bedroom' },
			queries: [
				{ kind: 'search-home', spaceId: 'space-bedroom' },
				{ kind: 'energy-summary', spaceId: 'space-kitchen' },
				{ kind: 'energy-summary', spaceId: 'space-office' },
				{ kind: 'energy-summary', spaceId: 'space-garage' },
			],
		});
	});

	it.each([
		'Turn Bedroom lights on starting Friday',
		'Turn Bedroom lights on effective Friday',
		'Turn Bedroom lights on from Friday onward',
		'Turn Bedroom lights on by the end of the day',
		'Turn Bedroom lights on at daybreak',
		'Turn Bedroom lights on at nightfall',
		'Turn Bedroom lights on for the weekend',
		'Turn Bedroom lights on for the night',
		'Turn Bedroom lights on overnight',
		'Turn Bedroom lights on all weekend',
		'Turn Bedroom lights on on my birthday',
		'Turn Bedroom lights on at closing time',
		'Turn Bedroom lights on quarterly',
		'Turn Bedroom lights on yearly',
		'Turn Bedroom lights on at breakfast',
		"Turn Bedroom lights on on New Year's Day",
		'Turn Bedroom lights on next holiday',
		'Turn Bedroom lights on in the spring',
		'Turn Bedroom lights on around lunchtime',
		'Turn Bedroom lights on by lunchtime',
		'Turn Bedroom lights on the next time I arrive',
	])('clarifies another unsupported temporal action family: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it.each([
		'Increase Bedroom lights by 5 percent',
		'Increase Bedroom lights by five percent',
		'Lower Bedroom thermostat by 2 degrees',
		'Raise Bedroom thermostat by two degrees',
		'Dim Bedroom lights by 10%',
	])('keeps a relative scalar adjustment on the reliable action path: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'none', strategy: 'model-tools' });
	});

	it.each([
		'Ensure you do not turn Bedroom lights on',
		'Remember not to turn Bedroom lights on',
		'You ought not turn Bedroom lights on',
		'It is forbidden to turn Bedroom lights on',
		'It is not allowed to turn Bedroom lights on',
		"You're not allowed to turn Bedroom lights on",
		'I request you not turn Bedroom lights on',
		'Do anything except turn Bedroom lights on',
		'Do everything other than turn Bedroom lights on',
	])('clarifies another direct action prohibition: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it.each([
		'Run when the Bedtime scene is ready',
		'Start when the irrigation device is ready',
		'Turn when the Bedroom light is off',
		'Open after the Garage door is closed',
		'Activate once the Bedtime routine is ready',
	])('does not mistake an immediate condition for an entity title: %s', (message) => {
		expect(
			service.plan({
				message,
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it.each(['Run "Party After Dark" scene', 'Run "Lights Before Dawn" scene', 'Turn "Light Before Dawn" lamp on'])(
		'keeps a condition word inside a quoted entity title: %s',
		(message) => {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ ambiguityRisk: 'none', strategy: 'model-tools' });
		},
	);

	it.each(['Run "Bedroom Lights" scene', 'Activate "Bedroom Fan" routine', 'Trigger "Kitchen Lamp" scene'])(
		'lets an explicit quoted scene kind win over device nouns in its title: %s',
		(message) => {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({
				intent: 'trigger',
				ambiguityRisk: 'none',
				strategy: 'model-tools',
				toolNames: ['search_home', 'run_scene'],
			});
		},
	);

	it.each(['Deactivate Kitchen Lamp scene', 'Stop Bedroom Fan routine'])(
		'keeps an inverse explicit scene request away from device controls: %s',
		(message) => {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ intent: 'trigger', ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
		},
	);

	it.each(["On New Year's Eve turn the bedroom light off", "On New Year's Eve activate Bedtime scene"])(
		'clarifies a leading New Year schedule instead of treating it as a read: %s',
		(message) => {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
		},
	);

	it.each([
		'Activate Bedroom Fan routine now',
		'Trigger Kitchen Lamp scene now',
		'Run Garage Door scene please',
		'Please run Bedroom Fan routine now',
		'Run routine Kitchen Lamp',
		'Activate routine called Kitchen Lamp',
		'Activate the routine Bedroom Fan now',
		'Activate Bedroom Fan routine right now',
		'Run Garage Door scene right away',
		'Activate Bedroom Fan routine for me now',
		'Activate Bedroom Fan routine ASAP',
		'Run Garage Door scene at once?',
		'Activate Bedroom Fan scene 2',
		'Run Garage Door routine number two',
		'Activate Bedroom Fan routine again',
		'Activate Bedroom Fan routine at the moment',
		'Activate Bedroom Fan routine pronto',
		'Activate Bedroom Fan routine already',
	])('keeps a polite explicit scene request away from device controls: %s', (message) => {
		expect(
			service.plan({
				message,
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			intent: 'trigger',
			ambiguityRisk: 'none',
			strategy: 'model-tools',
			toolNames: ['search_home', 'run_scene'],
		});
	});

	it('keeps a repeated explicit scene request away from device controls', () => {
		const result = service.plan({
			message: 'Run Garage Door scene one more time',
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(result).toMatchObject({ ambiguityRisk: 'none', strategy: 'model-tools' });
		expect(result.toolNames).toContain('run_scene');
		expect(result.toolNames).not.toContain('control_device');
	});

	it.each([
		'Start bedroom fan in scene mode',
		'Start garage door device in automation mode',
		'Run bedroom fan with Party scene',
	])('clarifies a device target with conflicting scene vocabulary: %s', (message) => {
		expect(
			service.plan({
				message,
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it.each(['Deactivate Kitchen Lamp scene now', 'Stop Bedroom Fan routine immediately', 'Stop routine Bedroom Fan'])(
		'keeps a polite inverse scene request away from device controls: %s',
		(message) => {
			expect(
				service.plan({
					message,
					providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
				}),
			).toMatchObject({ intent: 'trigger', ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
		},
	);

	it.each([
		"I don't want you to activate Bedtime scene",
		'Be sure not to activate Bedtime scene',
		'You may under no circumstances activate Bedtime scene',
		'Make certain not to activate Bedtime scene',
		'Make certain you do not activate Bedtime scene',
		'Make absolutely sure not to activate Bedtime scene',
		'Make absolutely certain you do not activate Bedtime scene',
		'Please make very sure not to activate Bedtime scene',
		"Make sure you don't activate Bedtime scene",
		'Make sure to never activate Bedtime scene',
		'Make sure you never activate Bedtime scene',
	])('clarifies another scene-action prohibition: %s', (message) => {
		expect(
			service.plan({
				message,
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it.each([
		'Activate Bedtime scene on Halloween',
		'Activate Bedtime scene on Thanksgiving',
		'Activate Bedtime scene on my anniversary',
		'Activate Bedtime scene next Easter',
		'Run Party scene come Halloween',
		'Activate Bedtime scene on Labor Day',
		'Activate Bedtime scene on Memorial Day',
		"Activate Bedtime scene on Valentine's Day",
		'Activate Bedtime scene on your birthday',
		'Activate Bedtime scene on our anniversary',
		'Activate Bedtime scene next bank holiday',
		'Activate Bedtime scene at Thanksgiving',
		'Activate Bedtime scene by Christmas',
		'Activate Bedtime scene around Christmas',
		'Activate Bedtime scene over Christmas',
		'Activate Bedtime scene for Christmas',
		'Activate Bedtime scene starting Christmas',
		'Activate Bedtime scene effective Christmas',
		'On Halloween turn the bedroom light off',
		'On Thanksgiving turn the bedroom light off',
		'On my anniversary turn the bedroom light off',
	])('clarifies another holiday-qualified action: %s', (message) => {
		expect(
			service.plan({
				message,
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it.each([
		'Turn Bedroom lights on hourly',
		'Turn Bedroom lights on biannually',
		'Turn Bedroom lights on bimonthly',
		'Turn Bedroom lights on next quarter',
		'Turn Bedroom lights on in Q4',
		'Turn Bedroom lights on on Easter',
		'Turn Bedroom lights on on December 25th',
		'Turn Bedroom lights on on 12/25',
		'Turn Bedroom lights on on the first of May',
		'Turn Bedroom lights on at tea time',
		'Turn Bedroom lights on at supper',
		'Turn Bedroom lights on at the weekend',
		'Turn Bedroom lights on weeknights',
	])('clarifies a calendar or recurrence-qualified action: %s', (message) => {
		expect(
			service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
	});

	it.each(['Was Bedroom power off yesterday?', 'Was the Bedroom power on last night?'])(
		'routes a historical power-state read through property history: %s',
		(message) => {
			const plan = service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			});

			expect(plan.domains).toEqual(['home', 'history']);
			expect(plan.queries).toContainEqual({ kind: 'property-timeseries', spaceId: 'space-bedroom' });
			expect(plan.queries).not.toContainEqual({ kind: 'current-state', spaceId: 'space-bedroom' });
		},
	);

	it.each([
		'How much energy did Bedroom use, and how much did Kitchen use?',
		'How much power did Bedroom use, and how much did Kitchen use?',
	])('inherits the energy domain for a coordinated ellipsis: %s', (message) => {
		const plan = service.plan({
			message,
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-kitchen', name: 'Kitchen' },
			],
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(plan.domains).toEqual(['energy']);
		expect(plan.queries).toEqual([
			{ kind: 'energy-summary', spaceId: 'space-bedroom' },
			{ kind: 'energy-summary', spaceId: 'space-kitchen' },
		]);
	});

	it.each([
		'How much energy did Bedroom use, and what about Kitchen?',
		'How much energy did Bedroom use, and Kitchen?',
	])('inherits energy only for a bounded known-space follow-up: %s', (message) => {
		const plan = service.plan({
			message,
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-kitchen', name: 'Kitchen' },
			],
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(plan.domains).toEqual(['energy']);
		expect(plan.queries).toEqual([
			{ kind: 'energy-summary', spaceId: 'space-bedroom' },
			{ kind: 'energy-summary', spaceId: 'space-kitchen' },
		]);
	});

	it.each([
		'How much energy did Bedroom use, and how much water did Kitchen use?',
		'How much energy did Bedroom use, and how much gas did Kitchen use?',
		'How much energy did Bedroom use, and how much data did Kitchen use?',
		'How much energy did Bedroom use, and how much fuel did Kitchen use?',
		'How much energy did Bedroom use, and how much battery did Kitchen use?',
	])('does not inherit energy across a competing measurement: %s', (message) => {
		const plan = service.plan({
			message,
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-kitchen', name: 'Kitchen' },
			],
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(plan.queries).toContainEqual({ kind: 'energy-summary', spaceId: 'space-bedroom' });
		expect(plan.queries).not.toContainEqual({ kind: 'energy-summary', spaceId: 'space-kitchen' });
		expect(plan.queries).not.toContainEqual({ kind: 'current-state', spaceId: 'space-kitchen' });
	});

	it('does not route an unsupported measured domain through home state', () => {
		const plan = service.plan({
			message: 'How much data did Kitchen use?',
			knownSpaces: [{ id: 'space-kitchen', name: 'Kitchen' }],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan).toMatchObject({ domains: ['general'], strategy: 'no-home-context', queries: [], toolNames: [] });
	});

	it.each([
		{ message: 'Did it rain yesterday?', query: { kind: 'weather' } },
		{ message: 'What was the weather yesterday?', query: { kind: 'weather' } },
		{ message: 'Was the house secure yesterday?', query: { kind: 'security-status' } },
		{ message: 'Were there security alerts yesterday?', query: { kind: 'security-status' } },
	])('clarifies a historical domain request without a history-capable query: $message', ({ message, query }) => {
		const plan = service.plan({
			message,
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(plan).toMatchObject({ ambiguityRisk: 'read', strategy: 'clarify', toolNames: [] });
		expect(plan.queries).toContainEqual(query);
	});

	it('keeps an energy condition out of the home-history scope', () => {
		const plan = service.plan({
			message: 'Was Bedroom light off yesterday while Kitchen used energy?',
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-kitchen', name: 'Kitchen' },
			],
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(plan.queries).toContainEqual({ kind: 'property-timeseries', spaceId: 'space-bedroom' });
		expect(plan.queries).toContainEqual({ kind: 'energy-summary', spaceId: 'space-kitchen' });
		expect(plan.queries).not.toContainEqual({ kind: 'property-timeseries', spaceId: 'space-kitchen' });
		expect(plan.queries).not.toContainEqual({ kind: 'search-home', spaceId: 'space-kitchen' });
	});

	it.each(['Turn it off if Bedroom temperature is low', 'Turn it off when Bedroom window is open'])(
		'keeps a trailing condition scope separate from a referenced action: %s',
		(message) => {
			const plan = service.plan({
				message,
				knownSpaces: [
					{ id: 'space-bedroom', name: 'Bedroom' },
					{ id: 'space-kitchen', name: 'Kitchen' },
				],
				recentEntityReferences: [
					{
						kind: 'property',
						id: 'lamp-kitchen',
						name: 'Kitchen lamp',
						spaceId: 'space-kitchen',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			});

			expect(plan).toMatchObject({
				scope: { referencedEntityIds: ['lamp-kitchen'] },
				ambiguityRisk: 'none',
				strategy: 'model-tools',
			});
		},
	);

	it.each(['Turn it off if it is on', 'Turn it off when it is on'])(
		'grounds a condition pronoun in the referenced action space: %s',
		(message) => {
			const plan = service.plan({
				message,
				conversationSpaceId: 'space-bedroom',
				recentEntityReferences: [
					{
						kind: 'property',
						id: 'lamp-kitchen',
						name: 'Kitchen lamp',
						spaceId: 'space-kitchen',
						compatibleActionTypes: ['turn'],
					},
				],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			});

			expect(plan.queries).toContainEqual({ kind: 'current-state', spaceId: 'space-kitchen' });
			expect(plan.queries).not.toContainEqual({ kind: 'current-state', spaceId: 'space-bedroom' });
			expect(plan).toMatchObject({ ambiguityRisk: 'none', strategy: 'model-tools' });
			expect(plan.toolNames).toContain('control_device');
		},
	);

	it('clarifies a referenced action with an unsupported condition predicate', () => {
		const plan = service.plan({
			message: 'Turn it off if it is hot',
			conversationSpaceId: 'space-bedroom',
			recentEntityReferences: [
				{
					kind: 'property',
					id: 'lamp-kitchen',
					name: 'Kitchen lamp',
					spaceId: 'space-kitchen',
					compatibleActionTypes: ['turn'],
				},
			],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan).toMatchObject({ ambiguityRisk: 'action', strategy: 'clarify', toolNames: [] });
		expect(plan.queries).not.toContainEqual({ kind: 'current-state', spaceId: 'space-bedroom' });
		expect(plan.queries).not.toContainEqual({ kind: 'current-state', spaceId: 'space-kitchen' });
	});

	it.each([
		'Turn it off if it is on, and what is Bedroom temperature?',
		'Turn it off if it is on, and what is the temperature here?',
		'Turn it off if it is on, and what is the temperature now?',
	])('keeps an independent conversation-space read beside a referenced condition: %s', (message) => {
		const plan = service.plan({
			message,
			conversationSpaceId: 'space-bedroom',
			knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
			recentEntityReferences: [
				{
					kind: 'property',
					id: 'lamp-kitchen',
					name: 'Kitchen lamp',
					spaceId: 'space-kitchen',
					compatibleActionTypes: ['turn'],
				},
			],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan.queries).toContainEqual({ kind: 'current-state', spaceId: 'space-kitchen' });
		expect(plan.queries).toContainEqual({ kind: 'current-state', spaceId: 'space-bedroom' });
	});

	it('keeps each domain scoped to its own condition segment', () => {
		const plan = service.plan({
			message: 'Compare Bedroom power usage when Kitchen power usage was high while Office lights were off',
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-kitchen', name: 'Kitchen' },
				{ id: 'space-office', name: 'Office' },
			],
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(plan.queries).toContainEqual({ kind: 'energy-summary', spaceId: 'space-bedroom' });
		expect(plan.queries).toContainEqual({ kind: 'energy-summary', spaceId: 'space-kitchen' });
		expect(plan.queries).not.toContainEqual({ kind: 'energy-summary', spaceId: 'space-office' });
		expect(plan.queries).toContainEqual({ kind: 'current-state', spaceId: 'space-office' });
	});

	it('keeps a second home condition out of an earlier energy scope', () => {
		const plan = service.plan({
			message: 'Was Bedroom light off yesterday while Kitchen used energy when Office window was open?',
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-kitchen', name: 'Kitchen' },
				{ id: 'space-office', name: 'Office' },
			],
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(plan.queries).toContainEqual({ kind: 'property-timeseries', spaceId: 'space-bedroom' });
		expect(plan.queries).toContainEqual({ kind: 'energy-summary', spaceId: 'space-kitchen' });
		expect(plan.queries).not.toContainEqual({ kind: 'energy-summary', spaceId: 'space-office' });
		expect(plan.queries).toContainEqual({ kind: 'property-timeseries', spaceId: 'space-office' });
	});

	it.each(['Is there a power outage in Bedroom?', 'What is Bedroom fan power status?'])(
		'routes a power event or status through home state rather than energy: %s',
		(message) => {
			const plan = service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			});

			expect(plan.queries).toContainEqual({ kind: 'current-state', spaceId: 'space-bedroom' });
			expect(plan.queries).not.toContainEqual({ kind: 'energy-summary', spaceId: 'space-bedroom' });
		},
	);

	it.each(['Was there a power outage in Bedroom yesterday?', 'Did Bedroom have a power failure yesterday?'])(
		'routes a historical power event through home history rather than energy: %s',
		(message) => {
			const plan = service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			});

			expect(plan.queries).toContainEqual({ kind: 'property-timeseries', spaceId: 'space-bedroom' });
			expect(plan.queries).not.toContainEqual({ kind: 'energy-summary', spaceId: 'space-bedroom' });
		},
	);

	it.each([
		'Show energy production from the power backup',
		'How much energy came from the power backup?',
		'Report the energy used by the power backup',
		'How much energy was used during the power interruption?',
		'Report energy after the power outage',
	])('preserves an energy read that mentions a power event: %s', (message) => {
		const plan = service.plan({
			message,
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(plan.domains).toEqual(['energy']);
		expect(plan.queries).toContainEqual({ kind: 'energy-summary' });
		expect(plan.queries).not.toContainEqual({ kind: 'current-state' });
	});

	it('does not add a global search for a conversation-default sibling read', () => {
		const plan = service.plan({
			message: 'Turn Kitchen lights on, and what is the temperature now?',
			conversationSpaceId: 'space-bedroom',
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-kitchen', name: 'Kitchen' },
			],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan.queries).toContainEqual({ kind: 'search-home', spaceId: 'space-bedroom' });
		expect(plan.queries).toContainEqual({ kind: 'search-home', spaceId: 'space-kitchen' });
		expect(plan.queries).not.toContainEqual({ kind: 'search-home' });
	});

	it.each(['What is the temperature in Anywhere Else?', 'How much energy did Anywhere Else use?'])(
		'does not confuse an explicit Anywhere Else space with an exclusion: %s',
		(message) => {
			const plan = service.plan({
				message,
				knownSpaces: [{ id: 'space-anywhere-else', name: 'Anywhere Else' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			});

			expect(plan).toMatchObject({ scope: { spaceId: 'space-anywhere-else' }, ambiguityRisk: 'none' });
		},
	);

	it.each([
		'What is the temperature now, and is the Kitchen light on?',
		'How much energy did we use today, and how much energy did Kitchen use today?',
	])('includes conversation-default and explicit read scopes in the public plan: %s', (message) => {
		const plan = service.plan({
			message,
			conversationSpaceId: 'space-bedroom',
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-kitchen', name: 'Kitchen' },
			],
			providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
		});

		expect(plan.scope.spaceIds).toHaveLength(2);
		expect(plan.scope.spaceIds).toEqual(expect.arrayContaining(['space-bedroom', 'space-kitchen']));
	});

	it('keeps past-tense weather in a mixed energy question', () => {
		expect(
			service.plan({
				message: 'How much energy did Bedroom use when it rained?',
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'unsupported', supportsStructuredToolResults: false },
			}),
		).toMatchObject({
			domains: ['weather', 'energy'],
			queries: [{ kind: 'weather' }, { kind: 'energy-summary', spaceId: 'space-bedroom' }],
		});
	});

	it('retains a bare temporal continuation in a scoped comparison', () => {
		const plan = service.plan({
			message: 'Compare Bedroom temperature now and yesterday',
			knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan.domains).toEqual(['home', 'history']);
		expect(plan.queries).toContainEqual({ kind: 'current-state', spaceId: 'space-bedroom' });
		expect(plan.queries).toContainEqual({ kind: 'property-timeseries', spaceId: 'space-bedroom' });
	});

	it('clarifies a temporally prefixed follow-up action', () => {
		const plan = service.plan({
			message: 'Turn Bedroom lights off and in 10 minutes turn them on',
			knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan).toMatchObject({ intent: 'write', ambiguityRisk: 'action', strategy: 'clarify' });
		expect(plan.toolNames).toEqual([]);
	});

	it('clarifies an until condition that requires future monitoring', () => {
		const plan = service.plan({
			message: 'Turn Bedroom lights on until Kitchen is warm',
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-kitchen', name: 'Kitchen' },
			],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan).toMatchObject({ intent: 'mixed', ambiguityRisk: 'action', strategy: 'clarify' });
		expect(plan.toolNames).toEqual([]);
	});

	it.each(['Could you shut off the Bedroom lights?', 'Shut down the Bedroom lights'])(
		'recognizes a shut-off device action: %s',
		(message) => {
			const plan = service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			});

			expect(plan).toMatchObject({ intent: 'write', ambiguityRisk: 'none', strategy: 'model-tools' });
			expect(plan.toolNames).toContain('control_device');
			expect(plan.toolNames).toContain('set_space_lighting');
		},
	);

	it.each([
		['Enable the Bedroom lights', 'Turn on the Bedroom lights'],
		['Disable the Bedroom lights', 'Turn off the Bedroom lights'],
		['Also enable the Bedroom lights', 'Also turn on the Bedroom lights'],
		['Please can you disable the Bedroom lights', 'Please can you turn off the Bedroom lights'],
		['Would you mind enabling the Bedroom lights?', 'Would you mind turning on the Bedroom lights?'],
		['Could you try disabling the Bedroom fan?', 'Could you try turning off the Bedroom fan?'],
		[
			'Are the Bedroom lights on? If so disable the Bedroom lights',
			'Are the Bedroom lights on? If so turn off the Bedroom lights',
		],
		['If the window is open enable the Bedroom lights', 'If the window is open turn the Bedroom lights on'],
	])('maps a binary-state action to turn semantics: %s', (message, equivalentMessage) => {
		const input = {
			knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
			providerCapabilities: { toolCalling: 'reliable' as const, supportsStructuredToolResults: true },
		};

		expect(service.plan({ ...input, message })).toEqual(service.plan({ ...input, message: equivalentMessage }));
	});

	it.each([
		'Is there a disable switch?',
		'Is the enable and disable switch available?',
		'Is the enable plus disable switch available?',
		'Is the enable as well as disable switch available?',
		'Which switch mode is selected, enable or disable?',
		'Which switch mode is selected, enable mode or disable mode?',
	])('does not treat a binary-state noun as an action: %s', (message) => {
		const plan = service.plan({
			message,
			conversationSpaceId: 'space-office',
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan).toMatchObject({ intent: 'read', ambiguityRisk: 'none' });
		expect(plan.toolNames).not.toContain('control_device');
		expect(plan.toolNames).not.toContain('set_space_lighting');
	});

	it.each([
		'If we disable the Bedroom lights will the camera still work?',
		'If we turn off the Bedroom lights will the camera still work?',
	])('keeps an unpunctuated hypothetical action on the read path: %s', (message) => {
		const plan = service.plan({
			message,
			knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan.intent).toBe('read');
		expect(plan.toolNames).not.toContain('control_device');
		expect(plan.toolNames).not.toContain('set_space_lighting');
	});

	it.each([
		[
			'Turn the Kitchen lights on plus disable the Bedroom lights',
			'Turn the Kitchen lights on plus turn off the Bedroom lights',
		],
		[
			'Turn the Kitchen lights on, also disable the Bedroom lights',
			'Turn the Kitchen lights on, also turn off the Bedroom lights',
		],
		[
			'Turn the Kitchen lights on and can you disable the Bedroom lights',
			'Turn the Kitchen lights on and can you turn off the Bedroom lights',
		],
	])('normalizes a binary-state action after a compound connector: %s', (message, equivalentMessage) => {
		const input = {
			knownSpaces: [
				{ id: 'space-bedroom', name: 'Bedroom' },
				{ id: 'space-kitchen', name: 'Kitchen' },
			],
			providerCapabilities: { toolCalling: 'reliable' as const, supportsStructuredToolResults: true },
		};

		expect(service.plan({ ...input, message })).toEqual(service.plan({ ...input, message: equivalentMessage }));
	});

	it.each([
		'What was the Bedroom temperature two days earlier?',
		'What was the Bedroom temperature three hours prior?',
	])('routes a relative earlier period to history: %s', (message) => {
		const plan = service.plan({
			message,
			knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan.domains).toContain('history');
		expect(plan.queries).toContainEqual({ kind: 'property-timeseries', spaceId: 'space-bedroom' });
		expect(plan.queries).not.toContainEqual({ kind: 'current-state', spaceId: 'space-bedroom' });
	});

	it.each(['Turn Bedroom lights on for 1½ hours', 'Turn Bedroom lights on for ¾ hour'])(
		'clarifies a Unicode fractional action duration: %s',
		(message) => {
			const plan = service.plan({
				message,
				knownSpaces: [{ id: 'space-bedroom', name: 'Bedroom' }],
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			});

			expect(plan).toMatchObject({ intent: 'write', ambiguityRisk: 'action', strategy: 'clarify' });
			expect(plan.toolNames).toEqual([]);
		},
	);

	it('recognizes a modal relative target clause without executing an unresolved subset', () => {
		const plan = service.plan({
			message: 'If the window is open, turn off the lights that could wake the baby?',
			conversationSpaceId: 'space-bedroom',
			providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
		});

		expect(plan).toMatchObject({ intent: 'mixed', ambiguityRisk: 'action', strategy: 'clarify' });
		expect(plan.toolNames).toEqual([]);
	});
});
