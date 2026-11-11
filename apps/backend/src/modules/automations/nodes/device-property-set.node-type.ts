import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsObject, ValidateNested } from 'class-validator';

import {
	AutomationActionNodeType,
	AutomationNodeConfigProblem,
	AutomationNodeConfigValidator,
	AutomationNodeReference,
} from '../graph/node-type';
import { TrackedValue } from '../tracker/state-tracker';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

import {
	DEVICE_PROPERTY_TARGET_SCHEMA,
	DevicePropertyLookup,
	DevicePropertyTargetDto,
	IsPropertyValue,
	PROPERTY_VALUE_SCHEMA,
	checkPropertyTarget,
	describeCommandValueProblem,
	describeValueMismatch,
	devicePropertyReferences,
	findPropertyForCheck,
	isWritable,
} from './device-property.utils';

export const DEVICE_PROPERTY_SET_NODE_TYPE = 'device.property.set';

/** The most values one action writes */
export const DEVICE_PROPERTY_SET_MAX_WRITES = 20;

export class DevicePropertyWriteDto extends DevicePropertyTargetDto {
	@IsPropertyValue({ message: '[{"field":"value","reason":"The value must be a text, a number or a yes/no value."}]' })
	value: TrackedValue;
}

export class DevicePropertySetConfigDto {
	@IsArray({ message: '[{"field":"writes","reason":"The values to set must be a list."}]' })
	@ArrayMinSize(1, { message: '[{"field":"writes","reason":"At least one value to set is needed."}]' })
	@ArrayMaxSize(DEVICE_PROPERTY_SET_MAX_WRITES, {
		message: `[{"field":"writes","reason":"At most ${DEVICE_PROPERTY_SET_MAX_WRITES} values can be set by one action."}]`,
	})
	// A list inside the list would pass the nested check unseen: it is checked item by item, and has none
	@IsObject({ each: true, message: '[{"field":"writes","reason":"Each value to set must be an object."}]' })
	@ValidateNested({ each: true })
	@Type(() => DevicePropertyWriteDto)
	writes: DevicePropertyWriteDto[];
}

export interface DevicePropertyCommand {
	propertyId: string;
	value: unknown;
	requestedDeviceId?: string;
	requestedChannelId?: string;
}

export interface DevicePropertyCommandsResult {
	success: boolean;
	results: { success: boolean; reason?: string }[];
}

/** The part of `PropertyCommandService` the action needs */
export interface DevicePropertyCommander {
	executePropertyCommands(commands: DevicePropertyCommand[]): Promise<DevicePropertyCommandsResult>;
}

export interface DevicePropertySetDependencies {
	commands: DevicePropertyCommander;
	findProperty: DevicePropertyLookup;
}

/**
 * The writes of one action grouped per device, in the order the devices first appear and with the order
 * of the writes kept inside a device. `executePropertyCommands` takes one device at a time and refuses a
 * batch that spans several (ADR 0003, decision 16).
 */
export const groupWritesByDevice = (writes: DevicePropertyWriteDto[]): Map<string, DevicePropertyWriteDto[]> => {
	const groups = new Map<string, DevicePropertyWriteDto[]>();

	for (const write of writes) {
		const group = groups.get(write.device_id);

		if (group) group.push(write);
		else groups.set(write.device_id, [write]);
	}

	return groups;
};

const describeError = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

/**
 * The action "set device values".
 *
 * One action may set several values. They are grouped per device and each device gets one call of
 * `PropertyCommandService.executePropertyCommands`, so the values of one device are applied together.
 * Devices are written side by side: a slow or offline device does not hold up the others. The action takes
 * `done` only when every value was accepted; otherwise it takes `error` with what was refused.
 *
 * The device and the channel named with a write are handed to the command service, which refuses a write
 * whose property is no longer the one of that channel and device.
 *
 * Refusing writes that reduce safety (unlock, disarm, open) is the job of the action policy of the engine,
 * which is asked before this action is executed and sees this configuration.
 */
export const createDevicePropertySetNodeType = (
	dependencies: DevicePropertySetDependencies,
): AutomationActionNodeType<DevicePropertySetConfigDto> => {
	const validateShape = createConfigValidatorFromDto(DevicePropertySetConfigDto);

	const validateConfig: AutomationNodeConfigValidator = async (config) => {
		const shape = await validateShape(config);

		if (shape.length > 0) return shape;

		const typed = config as unknown as DevicePropertySetConfigDto;
		const problems: AutomationNodeConfigProblem[] = [];
		const seen = new Set<string>();

		for (const [index, write] of typed.writes.entries()) {
			const prefix = `writes.${index}.`;

			if (seen.has(write.property_id)) {
				problems.push({ field: `${prefix}property_id`, reason: 'The same property is set twice by this action.' });

				continue;
			}

			seen.add(write.property_id);

			const property = await findPropertyForCheck(dependencies.findProperty, write.property_id);

			if (!property) continue;

			problems.push(...checkPropertyTarget(property, write, prefix));

			if (!isWritable(property)) {
				problems.push({ field: `${prefix}property_id`, reason: 'This property can not be set.' });

				continue;
			}

			// The kind of value first, for a plain reason; then what the command service will refuse when it runs
			const mismatch =
				describeValueMismatch(property, write.value) ?? describeCommandValueProblem(property, write.value);

			if (mismatch) problems.push({ field: `${prefix}value`, reason: mismatch });
		}

		return problems;
	};

	return {
		type: DEVICE_PROPERTY_SET_NODE_TYPE,
		kind: 'action',
		name: 'Set device value',
		description: 'Sets one or more device values. Values of the same device are applied together.',
		validateConfig,
		configSchema: {
			type: 'object',
			properties: {
				writes: {
					type: 'array',
					minItems: 1,
					maxItems: DEVICE_PROPERTY_SET_MAX_WRITES,
					description: 'The values to set. Values of the same device are applied together.',
					items: {
						type: 'object',
						properties: {
							...DEVICE_PROPERTY_TARGET_SCHEMA,
							value: { ...PROPERTY_VALUE_SCHEMA, description: 'The value to set.' },
						},
						required: ['device_id', 'channel_id', 'property_id', 'value'],
						additionalProperties: false,
					},
				},
			},
			required: ['writes'],
			additionalProperties: false,
		},
		references: (config) => {
			const references = new Map<string, AutomationNodeReference>();

			for (const write of Array.isArray(config.writes) ? config.writes : []) {
				if (typeof write !== 'object' || write === null) continue;

				for (const reference of devicePropertyReferences(write)) {
					references.set(`${reference.kind}:${reference.id}`, reference);
				}
			}

			return [...references.values()];
		},
		execute: async (config, context) => {
			if (context.signal.aborted) {
				return { success: false, reason: 'The run was cancelled before the values were set.' };
			}

			const groups = [...groupWritesByDevice(config.writes).values()];

			const outcomes = await Promise.all(
				groups.map(async (writes): Promise<{ failed: number; reasons: string[] }> => {
					try {
						const result = await dependencies.commands.executePropertyCommands(
							writes.map((write) => ({
								propertyId: write.property_id,
								value: write.value,
								requestedDeviceId: write.device_id,
								requestedChannelId: write.channel_id,
							})),
						);

						const refused = result.results.filter((item) => !item.success);

						if (result.success && refused.length === 0) return { failed: 0, reasons: [] };

						return {
							// A batch that failed as a whole may not say which of its values were refused
							failed: refused.length > 0 ? refused.length : writes.length,
							reasons: refused.map((item) => item.reason ?? 'The device refused the value.'),
						};
					} catch (error) {
						return { failed: writes.length, reasons: [describeError(error)] };
					}
				}),
			);

			const failed = outcomes.reduce((total, outcome) => total + outcome.failed, 0);

			if (failed === 0) return { success: true };

			const reasons = [...new Set(outcomes.flatMap((outcome) => outcome.reasons))];

			return {
				success: false,
				reason: `${failed} of ${config.writes.length} value(s) were not set${reasons.length > 0 ? `: ${reasons.join('; ')}` : '.'}`,
			};
		},
	};
};
