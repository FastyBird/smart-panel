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
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toEqual({
			domains: ['home', 'weather'],
			intent: 'mixed',
			scope: {},
			queries: [{ kind: 'search-home' }, { kind: 'current-state' }, { kind: 'weather' }],
			toolNames: ['search_home', 'query_home_state', 'control_device'],
			ambiguityRisk: 'none',
			strategy: 'model-tools',
		});
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
				message: 'Turn off the kitchen light',
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
		const device = { kind: 'device' as const, id: 'device-lamp', name: 'Lamp' };
		const scene = { kind: 'scene' as const, id: 'scene-movie-night', name: 'Movie night' };

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

	it.each(['Are any windows open in the whole house?', 'What is the bedroom temperature?'])(
		'does not force an explicit global or named-space read into conversation scope: %s',
		(message) => {
			const result = service.plan({
				message,
				conversationSpaceId: 'space-office',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			});

			expect(result.scope).toEqual({});
			expect(result.queries).not.toContainEqual(expect.objectContaining({ spaceId: 'space-office' }));
		},
	);

	it('keeps target-dependent start verbs available to compatible action tools', () => {
		expect(
			service.plan({
				message: 'Start the bedroom fan',
				providerCapabilities: { toolCalling: 'reliable', supportsStructuredToolResults: true },
			}),
		).toMatchObject({
			domains: ['home'],
			intent: 'mixed',
			ambiguityRisk: 'none',
			strategy: 'model-tools',
			toolNames: ['search_home', 'query_home_state', 'control_device', 'run_scene'],
		});
	});

	it('uses a unique recent reference and clarifies missing or ambiguous pronouns', () => {
		const providerCapabilities = { toolCalling: 'unsupported' as const, supportsStructuredToolResults: false };
		const reference = { kind: 'device' as const, id: 'device-reading-lamp', name: 'Reading lamp' };

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
				recentEntityReferences: [reference, { kind: 'device', id: 'device-desk-lamp', name: 'Desk lamp' }],
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
