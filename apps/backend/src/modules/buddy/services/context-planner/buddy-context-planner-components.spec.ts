import { buildBuddyContextToolCatalog, selectBuddyContextStrategy } from './buddy-context-plan-policy';
import { buildBuddyContextQueries } from './buddy-context-query-builder';
import { planBuddyContextRetrieval } from './buddy-context-retrieval-planner';

describe('Buddy context planner components', () => {
	describe('query builder', () => {
		it('preserves deterministic domain and scope ordering', () => {
			expect(
				buildBuddyContextQueries({
					domains: ['home', 'weather', 'energy', 'security', 'history'],
					hasAction: false,
					requiresReadForAction: false,
					searchSpaceIds: ['bedroom'],
					includeCurrentStateForRead: true,
					energySpaceIds: ['kitchen'],
					currentStateSpaceIds: ['bedroom'],
					historySpaceIds: ['office'],
				}),
			).toEqual([
				{ kind: 'search-home', spaceId: 'bedroom' },
				{ kind: 'current-state', spaceId: 'bedroom' },
				{ kind: 'weather' },
				{ kind: 'energy-summary', spaceId: 'kitchen' },
				{ kind: 'security-status' },
				{ kind: 'property-timeseries', spaceId: 'office' },
			]);
		});
	});

	describe('provider and tool policy', () => {
		it('selects model tools only for reliable structured home plans', () => {
			expect(
				selectBuddyContextStrategy('mixed', 'none', ['home'], {
					toolCalling: 'reliable',
					supportsStructuredToolResults: true,
				}),
			).toBe('model-tools');
			expect(
				selectBuddyContextStrategy('mixed', 'none', ['home', 'weather'], {
					toolCalling: 'reliable',
					supportsStructuredToolResults: true,
				}),
			).toBe('deterministic-action');
		});

		it('builds the minimal ordered model-visible tool catalog', () => {
			expect(
				buildBuddyContextToolCatalog({
					domains: ['home'],
					hasWrite: true,
					hasTrigger: true,
					strategy: 'model-tools',
					includeCurrentState: true,
					hasLightingGroupTarget: true,
				}),
			).toEqual(['search_home', 'query_home_state', 'control_device', 'set_space_lighting', 'run_scene']);
		});
	});

	describe('retrieval planner', () => {
		it('keeps action and read scopes separate while assembling the public plan', () => {
			const result = planBuddyContextRetrieval({
				domains: ['home'],
				hasAction: true,
				requiresReadForAction: true,
				includeCurrentStateForRead: true,
				hasActionScopedStateRequirement: false,
				hasUnscopedCurrentStateReadClause: false,
				hasWholeHomeRead: false,
				isGenericExplanation: false,
				hasExcessiveExplicitSpaceScope: false,
				hasExcessiveReferenceScope: false,
				conversationSpaceId: 'bedroom',
				querySpaceIds: ['kitchen'],
				energySpaceIds: [],
				historySpaceIds: ['kitchen'],
				resolvedCurrentStateSpaceIds: ['kitchen'],
				resolvedIndependentCurrentStateSpaceIds: ['kitchen'],
				actionScopeIds: ['bedroom'],
				scopedReferences: [],
				includeConversationCurrentState: false,
				useIndependentCurrentStateScopes: false,
			});

			expect(result).toEqual({
				scope: { spaceId: 'bedroom' },
				queries: [
					{ kind: 'search-home', spaceId: 'bedroom' },
					{ kind: 'search-home', spaceId: 'kitchen' },
					{ kind: 'current-state', spaceId: 'kitchen' },
				],
				hasCurrentStateQuery: true,
				searchSpaceIds: ['bedroom', 'kitchen'],
				currentStateSpaceIds: ['kitchen'],
			});
		});

		it('fails closed on excessive scopes without changing public scope metadata', () => {
			const result = planBuddyContextRetrieval({
				domains: ['home'],
				hasAction: false,
				requiresReadForAction: false,
				includeCurrentStateForRead: true,
				hasActionScopedStateRequirement: false,
				hasUnscopedCurrentStateReadClause: false,
				hasWholeHomeRead: false,
				isGenericExplanation: false,
				hasExcessiveExplicitSpaceScope: true,
				hasExcessiveReferenceScope: false,
				querySpaceIds: ['bedroom'],
				energySpaceIds: [],
				historySpaceIds: [],
				resolvedCurrentStateSpaceIds: ['bedroom'],
				resolvedIndependentCurrentStateSpaceIds: ['bedroom'],
				actionScopeIds: [],
				scopedReferences: [],
				includeConversationCurrentState: false,
				useIndependentCurrentStateScopes: true,
			});

			expect(result.scope).toEqual({ spaceId: 'bedroom' });
			expect(result.queries).toEqual([]);
		});

		it('orders independent read scopes before missing action-state scopes', () => {
			const result = planBuddyContextRetrieval({
				domains: ['home'],
				hasAction: true,
				requiresReadForAction: true,
				includeCurrentStateForRead: true,
				hasActionScopedStateRequirement: true,
				hasUnscopedCurrentStateReadClause: false,
				hasWholeHomeRead: false,
				isGenericExplanation: false,
				hasExcessiveExplicitSpaceScope: false,
				hasExcessiveReferenceScope: false,
				querySpaceIds: ['office'],
				energySpaceIds: [],
				historySpaceIds: [],
				resolvedCurrentStateSpaceIds: ['office'],
				resolvedIndependentCurrentStateSpaceIds: ['office', 'bedroom'],
				actionScopeIds: ['bedroom', 'kitchen'],
				scopedReferences: [],
				includeConversationCurrentState: false,
				useIndependentCurrentStateScopes: false,
			});

			expect(result.currentStateSpaceIds).toEqual(['office', 'bedroom', 'kitchen']);
			expect(result.queries).toEqual([
				{ kind: 'search-home', spaceId: 'bedroom' },
				{ kind: 'search-home', spaceId: 'kitchen' },
				{ kind: 'search-home', spaceId: 'office' },
				{ kind: 'current-state', spaceId: 'office' },
				{ kind: 'current-state', spaceId: 'bedroom' },
				{ kind: 'current-state', spaceId: 'kitchen' },
			]);
		});
	});
});
