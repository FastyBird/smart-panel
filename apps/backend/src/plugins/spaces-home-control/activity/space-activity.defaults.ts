import { ActivityConfigurationModel } from '../models/activity-configuration.model';
import { LightingMode, MediaActivityKey } from '../spaces-home-control.constants';

import { ActivityMode } from './space-activity.constants';

/** Authored defaults are copied into each space, never persisted as global/null-space roles. */
export function defaultActivityConfiguration(mode: ActivityMode): ActivityConfigurationModel {
	const off = mode === ActivityMode.SLEEP || mode === ActivityMode.AWAY;
	return {
		lighting: {
			enabled: true,
			mode: off ? LightingMode.OFF : mode === ActivityMode.WORK ? LightingMode.WORK : LightingMode.RELAX,
		},
		climate: { enabled: false },
		covers: {
			enabled: mode !== ActivityMode.AWAY,
			position: mode === ActivityMode.WORK ? 75 : mode === ActivityMode.RELAX ? 100 : 0,
		},
		media: {
			enabled: true,
			activity: mode === ActivityMode.RELAX ? MediaActivityKey.BACKGROUND : MediaActivityKey.OFF,
		},
		security: { enabled: false },
	};
}
