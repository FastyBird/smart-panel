import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { AUTOMATIONS_MODULE_NAME } from '../../automations/automations.constants';
import { AutomationsService } from '../../automations/services/automations.service';
import { ModuleConfigModel } from '../../config/models/config.model';
import { ConfigService } from '../../config/services/config.service';
import { IntentType } from '../../intents/intents.constants';
import { BUDDY_MODULE_NAME, SuggestionType } from '../buddy.constants';
import { formatIntentLabel, formatTimeLabel, interpolateTemplate } from '../buddy.utils';
import { EvaluatorRulesLoaderService } from '../spec/evaluator-rules-loader.service';
import { ResolvedPatternRule } from '../spec/evaluator-rules.types';

import {
	AutomationSuggestionDraft,
	ObservedPropertyWrite,
	buildAutomationSuggestionDraft,
} from './automation-suggestion-draft';
import { BuddyContext } from './buddy-context.service';
import { EvaluatorResult, HeartbeatEvaluator } from './heartbeat.types';
import { DetectedPattern, PatternDetectorService } from './pattern-detector.service';
import {
	DetectedSequencePattern,
	SceneSuggestionEvaluator,
	getTimePeriodLabel,
} from './scene-suggestion-evaluator.service';

export const AUTOMATION_ROUTINE_RULE_KEY = 'automation_routine';

/** How close to a routine of several actions a single repeated action has to be to be part of it */
const ROUTINE_OVERLAP_MINUTES = 60;

const DEFAULT_TITLE = 'Automate this routine?';

const DEFAULT_REASON =
	'You ${routineLabel} in ${spaceName} around ${timeLabel} regularly. ' +
	'Create an automation "${automationName}" that does it for you?';

/** A routine found by one of the pattern detectors, in the terms the draft is built from */
interface Routine {
	spaceId: string;
	source: 'multi-action' | 'single';
	timeOfDay: { hour: number; minute: number };
	occurrences: number;
	intentTypes: IntentType[];
	deviceIds: string[];
	actions: ObservedPropertyWrite[];
	/** `sequenceHash` for a routine of several actions, `intentType` for a single one: what the scene suggestion keys by */
	key: { sequenceHash: string } | { intentType: IntentType };
	routineLabel: string;
}

const minutesApart = (a: { hour: number; minute: number }, b: { hour: number; minute: number }): number => {
	const diff = Math.abs(a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

	return Math.min(diff, 1440 - diff);
};

/**
 * Offers an automation for a routine: the same writes done around the same time of day, as found by the detectors
 * the scene suggestions come from (a routine of several actions, or one action repeated). The suggestion carries the
 * draft of the automation - a time-of-day trigger and the observed writes - which the admin opens in the automation
 * editor. Nothing is created here, and the draft is never enabled by itself.
 *
 * A draft is offered only when the automations module would save it as an enabled automation: every write names a
 * property that can be set to that value, and none of them reduces safety (unlock, disarm, open). A routine with a
 * blocked write is not suggested as an automation at all.
 *
 * The scene suggestion for the same routine is still made: a scene is applied from the panel with one tap and runs
 * when asked, an automation is set up in the admin and runs on its own. The two are kept apart by their type.
 */
@Injectable()
export class AutomationSuggestionEvaluator implements HeartbeatEvaluator {
	readonly name = 'AutomationSuggestion';
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'AutomationSuggestionEvaluator');

	constructor(
		private readonly patternDetector: PatternDetectorService,
		private readonly sceneSuggestion: SceneSuggestionEvaluator,
		private readonly rulesLoader: EvaluatorRulesLoaderService,
		private readonly automationsService: AutomationsService,
		private readonly configService: ConfigService,
	) {}

	async evaluate(context: BuddyContext): Promise<EvaluatorResult[]> {
		const rule = this.rulesLoader.getPatternRule(AUTOMATION_ROUTINE_RULE_KEY);

		if ((rule && !rule.enabled) || !this.isAutomationsEnabled()) {
			return [];
		}

		const spaces = new Map(context.spaces.map((space) => [space.id, space.name]));
		const results: EvaluatorResult[] = [];

		for (const routine of this.findRoutines(new Set(spaces.keys()))) {
			const spaceName = spaces.get(routine.spaceId) ?? 'unknown space';
			const automationName = `${spaceName} ${getTimePeriodLabel(
				routine.timeOfDay.hour,
				this.rulesLoader.getPatternRule('multi_action_sequence'),
			)}`;

			const draft = buildAutomationSuggestionDraft({
				name: automationName,
				timeOfDay: routine.timeOfDay,
				actions: routine.actions,
			});

			if (draft === null || !(await this.canBeSaved(draft))) {
				continue;
			}

			results.push(this.toResult(routine, draft, spaceName, rule));
		}

		return results;
	}

	/**
	 * The routines of the spaces asked about. A single repeated action that is part of a routine of several actions
	 * at about the same time is that routine, not one of its own.
	 */
	private findRoutines(spaceIds: Set<string>): Routine[] {
		const sequenceRule = this.rulesLoader.getPatternRule('multi_action_sequence');
		const singleRule = this.rulesLoader.getPatternRule('single_pattern');

		const sequences =
			sequenceRule && !sequenceRule.enabled
				? []
				: this.sceneSuggestion.detectSequencePatterns().filter((pattern) => spaceIds.has(pattern.spaceId));

		const singles =
			singleRule && !singleRule.enabled
				? []
				: this.patternDetector.detectPatterns().filter((pattern) => spaceIds.has(pattern.spaceId));

		const isPartOfSequence = (pattern: DetectedPattern): boolean =>
			sequences.some(
				(sequence) =>
					sequence.spaceId === pattern.spaceId &&
					sequence.sequence.intentTypes.includes(pattern.intentType) &&
					minutesApart(sequence.timeOfDay, pattern.timeOfDay) <= ROUTINE_OVERLAP_MINUTES,
			);

		return [
			...sequences.map((pattern) => this.fromSequence(pattern)),
			...singles.filter((pattern) => !isPartOfSequence(pattern)).map((pattern) => this.fromSingle(pattern)),
		];
	}

	private fromSequence(pattern: DetectedSequencePattern): Routine {
		return {
			spaceId: pattern.spaceId,
			source: 'multi-action',
			timeOfDay: pattern.timeOfDay,
			occurrences: pattern.occurrences,
			intentTypes: pattern.sequence.intentTypes,
			deviceIds: pattern.sequence.deviceIds,
			actions: pattern.latestActions,
			key: { sequenceHash: pattern.sequence.hash },
			routineLabel: `perform ${pattern.sequence.intentTypes.length} actions`,
		};
	}

	private fromSingle(pattern: DetectedPattern): Routine {
		const targets = pattern.latestTargets ?? [];

		return {
			spaceId: pattern.spaceId,
			source: 'single',
			timeOfDay: pattern.timeOfDay,
			occurrences: pattern.occurrences,
			intentTypes: [pattern.intentType],
			deviceIds: [...new Set(targets.map((target) => target.deviceId))].sort(),
			actions: targets.map((target) => ({ ...target, value: pattern.latestValue })),
			key: { intentType: pattern.intentType },
			routineLabel: formatIntentLabel(pattern.intentType),
		};
	}

	/** Whether the automations module would save the draft as an enabled automation, safety policy included */
	private async canBeSaved(draft: AutomationSuggestionDraft): Promise<boolean> {
		try {
			const check = await this.automationsService.checkGraph(draft.graph, true);

			if (!check.valid) {
				this.logger.debug(
					`Routine not suggested as an automation: its draft has ${
						check.issues.filter((issue) => issue.blocking).length
					} blocking issue(s)`,
				);
			}

			return check.valid;
		} catch (error) {
			this.logger.warn(
				`Routine not suggested as an automation: its draft could not be checked: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);

			return false;
		}
	}

	private toResult(
		routine: Routine,
		draft: AutomationSuggestionDraft,
		spaceName: string,
		rule: ResolvedPatternRule | undefined,
	): EvaluatorResult {
		const template = rule?.messages.reason ? rule.messages.reason : DEFAULT_REASON;

		return {
			type: rule?.suggestionType ?? SuggestionType.PATTERN_AUTOMATION_CREATE,
			title: rule?.messages.title ? rule.messages.title : DEFAULT_TITLE,
			reason: interpolateTemplate(template, {
				routineLabel: routine.routineLabel,
				spaceName,
				timeLabel: formatTimeLabel(routine.timeOfDay.hour, routine.timeOfDay.minute),
				automationName: draft.name,
			}),
			spaceId: routine.spaceId,
			metadata: {
				sequence: routine.source,
				...routine.key,
				intentTypes: routine.intentTypes,
				deviceIds: routine.deviceIds,
				automationName: draft.name,
				timeOfDay: routine.timeOfDay,
				occurrences: routine.occurrences,
				draft,
			},
		};
	}

	private isAutomationsEnabled(): boolean {
		try {
			return this.configService.getModuleConfig<ModuleConfigModel>(AUTOMATIONS_MODULE_NAME).enabled !== false;
		} catch {
			return false;
		}
	}
}
