/*
 * The one line a space card shows on the canvas ("Living room becomes occupied", "Set Bedroom to Sleep"),
 * read from the configuration and from what the spaces store knows of the room or zone it names.
 */
import { type AutomationTranslate, formatAlternatives, formatChange } from '../../../modules/automations/nodes/nodes.summaries';

import {
	SpaceAutomationNodeType as NodeType,
	SPACE_ACTIVITY_MODES,
	SPACE_AUTOMATIONS_I18N_PREFIX,
	SPACE_LIGHTING_INTENTS,
	SPACE_LIGHTING_MODES,
	SPACE_LIGHTING_ROLES,
	SPACE_OCCUPANCY_STATES,
	type SpaceAutomationNodeType,
} from './space-automations.constants';

export interface ISpaceAutomationSummaryContext {
	t: AutomationTranslate;
	// The name of a room or zone; null when it is not known (not loaded, removed)
	spaceName: (id: string) => string | null;
}

const PREFIX = `${SPACE_AUTOMATIONS_I18N_PREFIX}.summaries`;

const PLUGIN = 'spacesHomeControlPlugin';

const optionOf = (config: Record<string, unknown>, key: string, allowed: readonly string[]): string | null =>
	typeof config[key] === 'string' && allowed.includes(config[key]) ? config[key] : null;

const modeLabel = (mode: string, t: AutomationTranslate): string => t(`${PLUGIN}.activityModes.modes.${mode}`);

type Summarize = (config: Record<string, unknown>, space: string, t: AutomationTranslate) => string | null;

const SUMMARIES: Record<SpaceAutomationNodeType, Summarize> = {
	[NodeType.OCCUPANCY_CHANGED]: (config, space, t) =>
		t(`${PREFIX}.occupancyChanged.${optionOf(config, 'to', SPACE_OCCUPANCY_STATES) ?? 'any'}`, { space }),
	[NodeType.OCCUPANCY_IS]: (config, space, t) => {
		const state = optionOf(config, 'state', SPACE_OCCUPANCY_STATES);

		return state === null ? null : t(`${PREFIX}.occupancyIs.${state}`, { space });
	},
	[NodeType.MODE_CHANGED]: (config, space, t) => {
		const label = (key: string): string | null => {
			const mode = optionOf(config, key, SPACE_ACTIVITY_MODES);

			return mode === null ? null : modeLabel(mode, t);
		};

		return formatChange(t(`${PREFIX}.modeOf`, { space }), label('from'), label('to'), t);
	},
	[NodeType.MODE_IS]: (config, space, t) => {
		const modes = Array.isArray(config.modes) ? SPACE_ACTIVITY_MODES.filter((mode) => (config.modes as unknown[]).includes(mode)) : [];

		if (modes.length === 0) return null;

		return t(`${PREFIX}.modeIs`, {
			space,
			modes: formatAlternatives(
				modes.map((mode) => modeLabel(mode, t)),
				t
			),
		});
	},
	[NodeType.MODE_SET]: (config, space, t) => {
		const mode = optionOf(config, 'mode', SPACE_ACTIVITY_MODES);

		return mode === null ? null : t(`${PREFIX}.modeSet`, { space, mode: modeLabel(mode, t) });
	},
	[NodeType.LIGHTING_INTENT]: (config, space, t) => {
		const intent = optionOf(config, 'intent', SPACE_LIGHTING_INTENTS);

		if (intent === null) return null;

		const mode = optionOf(config, 'mode', SPACE_LIGHTING_MODES);
		const role = optionOf(config, 'role', SPACE_LIGHTING_ROLES);
		const brightness = typeof config.brightness === 'number' ? config.brightness : null;

		if (intent === 'set_mode' && mode === null) return null;
		if (intent.startsWith('role_') && role === null) return null;
		if (intent === 'role_brightness' && brightness === null) return null;

		return t(`${PREFIX}.lighting.${intent}`, {
			space,
			mode: mode === null ? '' : t(`${PLUGIN}.activityModes.lightingModes.${mode}`),
			role: role === null ? '' : t(`${PLUGIN}.lightingRoles.${role}`),
			brightness: brightness ?? '',
		});
	},
};

const isSpaceType = (type: string): type is SpaceAutomationNodeType => Object.hasOwn(SUMMARIES, type);

/**
 * The summary of a space card; "not configured yet" while no room or zone is chosen, or the card is not
 * configured far enough to say what it does. Null for a type the plugin does not provide.
 */
export const summarizeSpaceNode = (type: string, config: Record<string, unknown>, context: ISpaceAutomationSummaryContext): string | null => {
	if (!isSpaceType(type)) return null;

	const { t } = context;
	const notConfigured = t('automations.editor.texts.notConfigured');
	const spaceId = typeof config.space_id === 'string' && config.space_id !== '' ? config.space_id : null;

	if (spaceId === null) return notConfigured;

	const space = context.spaceName(spaceId) ?? t(`${PREFIX}.unknownSpace`);

	return SUMMARIES[type](config, space, t) ?? notConfigured;
};
