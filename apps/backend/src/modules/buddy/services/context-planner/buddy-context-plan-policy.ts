import {
	BuddyContextAmbiguityRisk,
	BuddyContextDomain,
	BuddyContextIntent,
	BuddyContextProviderCapabilities,
	BuddyContextStrategy,
} from '../../models/context-plan.model';
import { QUERY_HOME_STATE_TOOL_NAME, SEARCH_HOME_TOOL_NAME } from '../home-context-tool-provider.service';

const CONTROL_DEVICE_TOOL_NAME = 'control_device';
const RUN_SCENE_TOOL_NAME = 'run_scene';
const SET_SPACE_LIGHTING_TOOL_NAME = 'set_space_lighting';

export interface BuddyContextToolCatalogInput {
	domains: readonly BuddyContextDomain[];
	hasWrite: boolean;
	hasTrigger: boolean;
	strategy: BuddyContextStrategy;
	includeCurrentState: boolean;
	hasLightingGroupTarget: boolean;
}

export function selectBuddyContextStrategy(
	intent: BuddyContextIntent,
	ambiguityRisk: BuddyContextAmbiguityRisk,
	domains: readonly BuddyContextDomain[],
	providerCapabilities: BuddyContextProviderCapabilities,
): BuddyContextStrategy {
	if (intent === 'none') return 'no-home-context';
	if (ambiguityRisk !== 'none') return 'clarify';

	const hasAction = intent === 'write' || intent === 'trigger' || intent === 'mixed';
	const canUseModelTools =
		providerCapabilities.toolCalling === 'reliable' &&
		providerCapabilities.supportsStructuredToolResults &&
		domains.every((domain) => domain === 'general' || domain === 'home');

	if (hasAction) return canUseModelTools ? 'model-tools' : 'deterministic-action';

	return canUseModelTools ? 'model-tools' : 'prefetch';
}

export function buildBuddyContextToolCatalog(input: BuddyContextToolCatalogInput): string[] {
	if (input.strategy !== 'model-tools') return [];

	const names: string[] = [];

	if (input.domains.includes('home')) names.push(SEARCH_HOME_TOOL_NAME);
	if (input.domains.includes('home') && input.includeCurrentState) names.push(QUERY_HOME_STATE_TOOL_NAME);
	if (input.hasWrite) {
		names.push(CONTROL_DEVICE_TOOL_NAME);
		if (input.hasLightingGroupTarget) names.push(SET_SPACE_LIGHTING_TOOL_NAME);
	}
	if (input.hasTrigger) names.push(RUN_SCENE_TOOL_NAME);

	return names;
}
