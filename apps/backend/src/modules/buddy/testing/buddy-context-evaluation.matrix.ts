export type BuddyContextEvaluationStrategy =
	| 'no-home-context'
	| 'model-tools'
	| 'prefetch'
	| 'deterministic-action'
	| 'clarify';

export type BuddyContextEvaluationDomain = 'general' | 'home' | 'weather' | 'energy' | 'security' | 'history';

export interface BuddyContextEvaluationEntityReference {
	kind: 'device' | 'space' | 'scene' | 'property';
	id: string;
	name: string;
	compatibleActionTypes: readonly ['turn'];
}

export interface BuddyContextEvaluationPriorTurn {
	role: 'user' | 'assistant';
	content: string;
	entityReferences?: readonly BuddyContextEvaluationEntityReference[];
}

export interface BuddyContextEvaluationCase {
	id: string;
	message: string;
	conversationSpaceId: string | null;
	priorTurns?: readonly BuddyContextEvaluationPriorTurn[];
	expectedDomains: BuddyContextEvaluationDomain[];
	expectedStrategy: BuddyContextEvaluationStrategy;
	expectsAction: boolean;
	currentEagerSnapshot: true;
}

/**
 * Stable message corpus used from Phase 0 through the production-path switch.
 *
 * Phase 0 characterizes today's eager behavior. Later phases keep the same rows
 * and change assertions to the expected bounded strategy and domains.
 */
export const BUDDY_CONTEXT_EVALUATION_MATRIX: readonly BuddyContextEvaluationCase[] = [
	{
		id: 'casual-greeting',
		message: 'Hi',
		conversationSpaceId: null,
		expectedDomains: ['general'],
		expectedStrategy: 'no-home-context',
		expectsAction: false,
		currentEagerSnapshot: true,
	},
	{
		id: 'general-explanation',
		message: 'How does a thermostat work?',
		conversationSpaceId: null,
		expectedDomains: ['general'],
		expectedStrategy: 'no-home-context',
		expectsAction: false,
		currentEagerSnapshot: true,
	},
	{
		id: 'scoped-current-state',
		message: 'What is the bedroom temperature?',
		conversationSpaceId: null,
		expectedDomains: ['home'],
		expectedStrategy: 'model-tools',
		expectsAction: false,
		currentEagerSnapshot: true,
	},
	{
		id: 'contextual-current-state',
		message: 'Is it too warm in here?',
		conversationSpaceId: 'space-000',
		expectedDomains: ['home'],
		expectedStrategy: 'model-tools',
		expectsAction: false,
		currentEagerSnapshot: true,
	},
	{
		id: 'global-aggregate',
		message: 'Are any windows open?',
		conversationSpaceId: null,
		expectedDomains: ['home'],
		expectedStrategy: 'model-tools',
		expectsAction: false,
		currentEagerSnapshot: true,
	},
	{
		id: 'target-discovery',
		message: 'Which lights can I dim?',
		conversationSpaceId: null,
		expectedDomains: ['home'],
		expectedStrategy: 'model-tools',
		expectsAction: false,
		currentEagerSnapshot: true,
	},
	{
		id: 'exact-device-control',
		message: 'Set kitchen light to 40%',
		conversationSpaceId: 'space-000',
		expectedDomains: ['home'],
		expectedStrategy: 'deterministic-action',
		expectsAction: true,
		currentEagerSnapshot: true,
	},
	{
		id: 'ambiguous-control',
		message: 'Turn on the lamp',
		conversationSpaceId: null,
		expectedDomains: ['home'],
		expectedStrategy: 'clarify',
		expectsAction: true,
		currentEagerSnapshot: true,
	},
	{
		id: 'scene-trigger',
		message: 'Start movie night',
		conversationSpaceId: null,
		expectedDomains: ['home'],
		expectedStrategy: 'deterministic-action',
		expectsAction: true,
		currentEagerSnapshot: true,
	},
	{
		id: 'weather',
		message: 'Will it rain tomorrow?',
		conversationSpaceId: null,
		expectedDomains: ['weather'],
		expectedStrategy: 'prefetch',
		expectsAction: false,
		currentEagerSnapshot: true,
	},
	{
		id: 'energy',
		message: 'How much power did we use today?',
		conversationSpaceId: null,
		expectedDomains: ['energy'],
		expectedStrategy: 'prefetch',
		expectsAction: false,
		currentEagerSnapshot: true,
	},
	{
		id: 'security',
		message: 'Is the house secure?',
		conversationSpaceId: null,
		expectedDomains: ['security'],
		expectedStrategy: 'prefetch',
		expectsAction: false,
		currentEagerSnapshot: true,
	},
	{
		id: 'historical',
		message: 'Graph the living-room temperature for 24 hours',
		conversationSpaceId: null,
		expectedDomains: ['home', 'history'],
		expectedStrategy: 'prefetch',
		expectsAction: false,
		currentEagerSnapshot: true,
	},
	{
		id: 'recent-reference-follow-up-resolvable',
		message: 'Turn it off',
		conversationSpaceId: 'space-000',
		priorTurns: [
			{ role: 'user', content: 'Turn on the reading lamp.' },
			{
				role: 'assistant',
				content: 'The reading lamp is now on.',
				entityReferences: [
					{
						kind: 'device',
						id: 'device-reading-lamp',
						name: 'Reading lamp',
						compatibleActionTypes: ['turn'],
					},
				],
			},
		],
		expectedDomains: ['home'],
		expectedStrategy: 'deterministic-action',
		expectsAction: true,
		currentEagerSnapshot: true,
	},
	{
		id: 'recent-reference-follow-up-missing',
		message: 'Turn it off',
		conversationSpaceId: 'space-000',
		expectedDomains: ['home'],
		expectedStrategy: 'clarify',
		expectsAction: true,
		currentEagerSnapshot: true,
	},
	{
		id: 'recent-reference-follow-up-ambiguous',
		message: 'Turn it off',
		conversationSpaceId: 'space-000',
		priorTurns: [
			{ role: 'user', content: 'Turn on both bedside lamps.' },
			{
				role: 'assistant',
				content: 'Both bedside lamps are now on.',
				entityReferences: [
					{
						kind: 'device',
						id: 'device-left-bedside-lamp',
						name: 'Left bedside lamp',
						compatibleActionTypes: ['turn'],
					},
					{
						kind: 'device',
						id: 'device-right-bedside-lamp',
						name: 'Right bedside lamp',
						compatibleActionTypes: ['turn'],
					},
				],
			},
		],
		expectedDomains: ['home'],
		expectedStrategy: 'clarify',
		expectsAction: true,
		currentEagerSnapshot: true,
	},
	{
		id: 'compound-multi-domain',
		message: 'If it is colder outside, lower the office thermostat',
		conversationSpaceId: null,
		expectedDomains: ['home', 'weather'],
		expectedStrategy: 'deterministic-action',
		expectsAction: true,
		currentEagerSnapshot: true,
	},
	{
		id: 'unsupported-domain',
		message: 'Book a flight',
		conversationSpaceId: null,
		expectedDomains: ['general'],
		expectedStrategy: 'no-home-context',
		expectsAction: false,
		currentEagerSnapshot: true,
	},
];

export const BUDDY_CONTEXT_CURRENT_BASELINE = {
	maxStoredHistoryRows: 19,
	promptBudgetRatio: 0.8,
	eagerDomains: ['spaces', 'devices', 'scenes', 'weather', 'energy'] as const,
	optionalDomainFailure: 'omit-domain-and-continue',
	providerFailure: 'abort-before-message-persistence',
	toolResultTransport: 'status-and-message-only',
} as const;
