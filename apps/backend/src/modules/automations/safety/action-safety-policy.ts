/**
 * Decides whether what an action is about to do reduces safety.
 *
 * Framework-free (ADR 0003, decision 15). The policy does not know the cards: an action node type says
 * what it will do with `commands()`, and the policy looks at that - a value written to a property, or a
 * scene to run. A scene is opened and every one of its enabled actions is looked at as it is right now,
 * so a scene edited after the automation was saved is judged by what it does today.
 *
 * The same policy is asked when a graph is saved and before every action of a run. What reduces safety is
 * decided in one place, `safety-rules.ts`.
 *
 * A lookup that fails is not swallowed: `inspect` rejects, and the caller refuses what it could not check.
 */
import { AutomationActionCommand } from '../graph/node-type';

import {
	SafetyReducingKind,
	SafetyWriteTarget,
	classifySafetyReducingWrite,
	describeSafetyRefusal,
} from './safety-rules';

/** One enabled action of a scene, as far as the policy can read it */
export interface SafetySceneAction {
	/** The property the action writes to; null when the action is of a kind the policy can not read */
	propertyId: string | null;
	value: unknown;
}

export interface ActionSafetyLookups {
	/** The categories of a property, its channel and its device; null when the property does not exist */
	findTarget(propertyId: string): Promise<SafetyWriteTarget | null>;
	/** The enabled actions of a scene as they are now; null when the scene does not exist */
	listSceneActions(sceneId: string): Promise<SafetySceneAction[] | null>;
}

export interface SafetyFinding {
	/** `unreadable` for a scene action the policy can not look into */
	kind: SafetyReducingKind | 'unreadable';
	/** Whether the node itself writes the value or a scene it runs does */
	via: 'write' | 'scene';
	/** Shown to the user; never repeats a configured value */
	reason: string;
	/** Path of the configuration field the finding is about */
	field?: string;
}

export const SAFETY_UNREADABLE_SCENE_ACTION_REASON =
	'The scene was not run: it contains an action that can not be checked for safety.';

export const describeSceneSafetyRefusal = (action: string): string =>
	`The scene was not run: it would ${action}, which an automation can not do.`;

export class ActionSafetyPolicy {
	public constructor(private readonly lookups: ActionSafetyLookups) {}

	/**
	 * Returns what of `commands` reduces safety; an empty list lets the action through. A property or a
	 * scene that does not exist is not a finding: the action fails on it by itself.
	 */
	public async inspect(commands: readonly AutomationActionCommand[]): Promise<SafetyFinding[]> {
		const findings: SafetyFinding[] = [];
		const targets = new Map<string, Promise<SafetyWriteTarget | null>>();

		for (const command of commands) {
			const field = command.field !== undefined ? { field: command.field } : {};

			if (command.kind === 'property_write') {
				const match = await this.classify(command.propertyId, command.value, targets);

				if (match) {
					findings.push({ kind: match.kind, via: 'write', reason: describeSafetyRefusal(match), ...field });
				}

				continue;
			}

			const actions = await this.lookups.listSceneActions(command.sceneId);

			for (const finding of await this.inspectSceneActions(actions ?? [], targets)) {
				findings.push({ ...finding, ...field });
			}
		}

		return findings;
	}

	/**
	 * Returns what of the enabled actions of a scene reduces safety, each kind once. An action the policy
	 * can not read is a finding: a scene is run as a whole, so what can not be checked can not be let run.
	 */
	public async inspectSceneActions(
		actions: readonly SafetySceneAction[],
		targets = new Map<string, Promise<SafetyWriteTarget | null>>(),
	): Promise<SafetyFinding[]> {
		const findings = new Map<string, SafetyFinding>();

		for (const action of actions) {
			if (action.propertyId === null) {
				findings.set('unreadable', {
					kind: 'unreadable',
					via: 'scene',
					reason: SAFETY_UNREADABLE_SCENE_ACTION_REASON,
				});

				continue;
			}

			const match = await this.classify(action.propertyId, action.value, targets);

			if (match && !findings.has(match.kind)) {
				findings.set(match.kind, {
					kind: match.kind,
					via: 'scene',
					reason: describeSceneSafetyRefusal(match.action),
				});
			}
		}

		return [...findings.values()];
	}

	private async classify(
		propertyId: string,
		value: unknown,
		targets: Map<string, Promise<SafetyWriteTarget | null>>,
	): Promise<ReturnType<typeof classifySafetyReducingWrite>> {
		let lookup = targets.get(propertyId);

		if (lookup === undefined) {
			lookup = this.lookups.findTarget(propertyId);
			targets.set(propertyId, lookup);
		}

		const target = await lookup;

		return target ? classifySafetyReducingWrite(target, value) : null;
	}
}
