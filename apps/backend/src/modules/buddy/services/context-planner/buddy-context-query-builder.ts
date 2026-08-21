import { BuddyContextDomain, BuddyContextQueryPlan } from '../../models/context-plan.model';

export interface BuddyContextQueryBuildInput {
	domains: readonly BuddyContextDomain[];
	hasAction: boolean;
	requiresReadForAction: boolean;
	searchSpaceIds: readonly (string | undefined)[];
	includeCurrentStateForRead: boolean;
	energySpaceIds: readonly (string | undefined)[];
	currentStateSpaceIds: readonly (string | undefined)[];
	historySpaceIds: readonly (string | undefined)[];
}

export function buildBuddyContextQueries(input: BuddyContextQueryBuildInput): BuddyContextQueryPlan[] {
	const queries: BuddyContextQueryPlan[] = [];
	const searchScopes = toScopes(input.searchSpaceIds);
	const energyScopes = toScopes(input.energySpaceIds);
	const currentStateScopes = toScopes(input.currentStateSpaceIds);
	const historyScopes = toScopes(input.historySpaceIds);

	if (input.domains.includes('home')) {
		for (const scoped of searchScopes) queries.push({ kind: 'search-home', ...scoped });
		if ((!input.hasAction && input.includeCurrentStateForRead) || input.requiresReadForAction) {
			for (const scoped of currentStateScopes) queries.push({ kind: 'current-state', ...scoped });
		}
	}
	if (input.domains.includes('weather')) queries.push({ kind: 'weather' });
	if (input.domains.includes('energy')) {
		for (const scoped of energyScopes) queries.push({ kind: 'energy-summary', ...scoped });
	}
	if (input.domains.includes('security')) queries.push({ kind: 'security-status' });
	if (input.domains.includes('history')) {
		for (const scoped of historyScopes) queries.push({ kind: 'property-timeseries', ...scoped });
	}

	return queries;
}

function toScopes(spaceIds: readonly (string | undefined)[]): Array<{ spaceId?: string }> {
	return spaceIds.length > 0 ? spaceIds.map((spaceId) => (spaceId ? { spaceId } : {})) : [{}];
}
