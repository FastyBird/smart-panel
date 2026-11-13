/**
 * What the space cards of the plugin share (ADR 0003, decision 13): the plugin as their owner, the way a
 * card points at a space, and the way a failure is put into a reason.
 */
import { IsUUID } from 'class-validator';

import { AutomationNodeReference, AutomationNodeTypeOwner } from '../../../modules/automations/graph/node-type';
import { ActivityMode } from '../activity/space-activity.constants';
import { SPACES_HOME_CONTROL_PLUGIN_NAME } from '../spaces-home-control.constants';

/** The engine arms and runs these cards only while the plugin is enabled, and the catalogue lists them only then */
export const SPACE_CARD_OWNER: AutomationNodeTypeOwner = { kind: 'plugin', type: SPACES_HOME_CONTROL_PLUGIN_NAME };

export const ACTIVITY_MODES = Object.values(ActivityMode);

export const SPACE_ID_REASON = 'A room or a zone must be chosen.';

/** A card points at one room or zone */
export class SpaceTargetDto {
	@IsUUID('4', { message: JSON.stringify([{ field: 'space_id', reason: SPACE_ID_REASON }]) })
	space_id: string;
}

export const SPACE_ID_SCHEMA = {
	type: 'string',
	format: 'uuid',
	description: 'The room or zone.',
} as const;

/** The space is a reference, so an automation using a space that is deleted is marked invalid */
export const spaceReferences = (config: { space_id?: unknown }): AutomationNodeReference[] =>
	typeof config?.space_id === 'string' ? [{ kind: 'space', id: config.space_id }] : [];

export const describeError = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

export const given = <T>(value: T | null | undefined): value is T => value !== undefined && value !== null;
