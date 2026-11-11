/**
 * Node types for tests. No concrete node type ships with the module yet, so the unit and e2e tests
 * register these instead. They are never registered by the application.
 */
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import {
	AutomationActionNodeType,
	AutomationConditionNodeType,
	AutomationFlowNodeType,
	AutomationNodeType,
	AutomationTriggerNodeType,
} from '../graph/node-type';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

export const FAKE_TRIGGER_TYPE = 'test.trigger';
export const FAKE_CONDITION_TYPE = 'test.condition';
export const FAKE_ACTION_TYPE = 'test.action';
export const FAKE_STRICT_ACTION_TYPE = 'test.strict-action';
export const FAKE_JOIN_TYPE = 'test.join';

export class FakeStrictActionConfigDto {
	@IsInt({ message: '[{"field":"level","reason":"Level must be a whole number."}]' })
	@Min(0, { message: '[{"field":"level","reason":"Level must be between 0 and 100."}]' })
	@Max(100, { message: '[{"field":"level","reason":"Level must be between 0 and 100."}]' })
	level: number;

	@IsOptional()
	@IsString()
	scene_id?: string;
}

export const FAKE_STRICT_ACTION_CONFIG_SCHEMA = {
	type: 'object',
	properties: {
		level: { type: 'integer', minimum: 0, maximum: 100 },
		scene_id: { type: 'string' },
	},
	required: ['level'],
	additionalProperties: false,
};

/** Accepts any configuration */
export const fakeTrigger: AutomationTriggerNodeType = {
	type: FAKE_TRIGGER_TYPE,
	kind: 'trigger',
	name: 'Test trigger',
	description: 'Starts a run in tests.',
	validateConfig: () => [],
	subscribe: () => () => undefined,
};

/** Accepts any configuration */
export const fakeCondition: AutomationConditionNodeType = {
	type: FAKE_CONDITION_TYPE,
	kind: 'condition',
	name: 'Test condition',
	description: 'Always passes in tests.',
	validateConfig: () => [],
	evaluate: () => Promise.resolve({ result: true }),
};

/** Accepts any configuration */
export const fakeAction: AutomationActionNodeType = {
	type: FAKE_ACTION_TYPE,
	kind: 'action',
	name: 'Test action',
	description: 'Does nothing in tests.',
	validateConfig: () => [],
	execute: () => Promise.resolve({ success: true }),
};

/** Configuration checked by a DTO class, the way real node types declare theirs */
export const fakeStrictAction: AutomationActionNodeType<FakeStrictActionConfigDto> = {
	type: FAKE_STRICT_ACTION_TYPE,
	kind: 'action',
	name: 'Test strict action',
	description: 'Needs a level between 0 and 100.',
	validateConfig: createConfigValidatorFromDto(FakeStrictActionConfigDto),
	configSchema: FAKE_STRICT_ACTION_CONFIG_SCHEMA,
	references: (config) => (config.scene_id ? [{ kind: 'scene', id: config.scene_id }] : []),
	execute: () => Promise.resolve({ success: true }),
};

/** A flow type with ports of its own */
export const fakeJoin: AutomationFlowNodeType = {
	type: FAKE_JOIN_TYPE,
	kind: 'flow',
	name: 'Test join',
	description: 'Joins two branches in tests.',
	ports: { inputs: ['a', 'b'], outputs: ['out'] },
	validateConfig: () => [],
};

export const FAKE_NODE_TYPES: AutomationNodeType<any>[] = [
	fakeTrigger,
	fakeCondition,
	fakeAction,
	fakeStrictAction,
	fakeJoin,
];
