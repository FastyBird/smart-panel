import { IsUUID } from 'class-validator';

import { AutomationActionNodeType } from '../graph/node-type';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

export const SCENE_RUN_NODE_TYPE = 'scene.run';

/** The `triggeredBy` label a scene run started by an automation carries */
export const SCENE_RUN_TRIGGERED_BY = 'automation';

/** A scene runs its own actions one device after another, so it gets longer than the default */
export const SCENE_RUN_TIMEOUT_SECONDS = 60;

export class SceneRunConfigDto {
	@IsUUID('4', { message: '[{"field":"scene_id","reason":"A scene must be chosen."}]' })
	scene_id: string;
}

export interface SceneRunOutcome {
	status: string;
	error?: string | null;
}

/** The part of `SceneExecutorService` the action needs */
export interface SceneRunner {
	triggerScene(sceneId: string, triggeredBy?: string): Promise<SceneRunOutcome>;
}

const describeError = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

/**
 * The action "run a scene".
 *
 * It takes `done` only when every action of the scene succeeded. A scene that completed partly, failed,
 * is disabled or no longer exists takes `error`, with the reason the scenes module gave.
 *
 * A scene that would unlock, disarm or open is not run by an automation at all. The safety policy reads
 * the scene named by `commands()` before the action is executed, and the scene runner is handed the same
 * check for the very actions it is about to run, so a scene edited in between is still refused.
 */
export const createSceneRunNodeType = (scenes: SceneRunner): AutomationActionNodeType<SceneRunConfigDto> => ({
	type: SCENE_RUN_NODE_TYPE,
	kind: 'action',
	name: 'Run scene',
	description: 'Runs a scene and waits until it has finished.',
	timeoutSeconds: SCENE_RUN_TIMEOUT_SECONDS,
	validateConfig: createConfigValidatorFromDto(SceneRunConfigDto),
	configSchema: {
		type: 'object',
		properties: {
			scene_id: { type: 'string', format: 'uuid', description: 'The scene to run.' },
		},
		required: ['scene_id'],
		additionalProperties: false,
	},
	references: (config) => (typeof config.scene_id === 'string' ? [{ kind: 'scene', id: config.scene_id }] : []),
	commands: (config) =>
		typeof config?.scene_id === 'string' ? [{ kind: 'scene_run', sceneId: config.scene_id, field: 'scene_id' }] : [],
	execute: async (config, context) => {
		if (context.signal.aborted) {
			return { success: false, reason: 'The run was cancelled before the scene was started.' };
		}

		try {
			const outcome = await scenes.triggerScene(config.scene_id, SCENE_RUN_TRIGGERED_BY);

			if (outcome.status === 'completed') return { success: true };

			return { success: false, reason: outcome.error ?? `The scene ended as ${outcome.status}.` };
		} catch (error) {
			return { success: false, reason: describeError(error) };
		}
	},
});
