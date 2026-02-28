import { SuggestionType } from '../buddy.constants';

import { BuddyContext } from './buddy-context.service';

export interface EvaluatorResult {
	type: SuggestionType;
	title: string;
	reason: string;
	spaceId: string;
	metadata: Record<string, unknown>;
}

export interface HeartbeatEvaluator {
	readonly name: string;
	evaluate(context: BuddyContext): Promise<EvaluatorResult[]>;
}
