import { IsUUID } from 'class-validator';

import { AutomationTriggerNodeType } from '../graph/node-type';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

import { SceneRunEvent } from './bus-events.types';

export const SCENE_WAS_RUN_NODE_TYPE = 'scene.was-run';

export class SceneWasRunConfigDto {
	@IsUUID('4', { message: '[{"field":"scene_id","reason":"A scene must be chosen."}]' })
	scene_id: string;
}

/** The part of the event source the trigger needs */
export interface SceneRunSource {
	onSceneRun(listener: (run: SceneRunEvent) => void): () => void;
}

/**
 * The trigger "a scene was run".
 *
 * It starts once a run of the scene has finished (`ScenesModule.Scene.Triggered`), whoever ran it - the
 * panel, the admin, Buddy or an automation - and however it ended; the trace says which. A scene that could
 * not be started at all, because it is disabled or not triggerable, was not run and starts nothing.
 */
export const createSceneWasRunNodeType = (source: SceneRunSource): AutomationTriggerNodeType<SceneWasRunConfigDto> => ({
	type: SCENE_WAS_RUN_NODE_TYPE,
	kind: 'trigger',
	name: 'Scene was run',
	description: 'Starts when a scene has been run, from anywhere.',
	validateConfig: createConfigValidatorFromDto(SceneWasRunConfigDto),
	configSchema: {
		type: 'object',
		properties: {
			scene_id: { type: 'string', format: 'uuid', description: 'The scene to watch.' },
		},
		required: ['scene_id'],
		additionalProperties: false,
	},
	references: (config) => (typeof config.scene_id === 'string' ? [{ kind: 'scene', id: config.scene_id }] : []),
	subscribe: (config, fire) =>
		source.onSceneRun((run) => {
			if (run.sceneId !== config.scene_id) return;

			fire({ scene_id: run.sceneId, status: run.status, triggered_by: run.triggeredBy });
		}),
});
