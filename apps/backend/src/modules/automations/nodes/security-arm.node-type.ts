import { IsIn } from 'class-validator';

import { ChannelCategory, PropertyCategory } from '../../devices/devices.constants';
import { ArmedState } from '../../security/security.constants';
import { AutomationActionNodeType, AutomationNodeConfigValidator } from '../graph/node-type';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

import { DevicePropertyCommander } from './device-property-set.node-type';
import {
	DEVICE_PROPERTY_TARGET_SCHEMA,
	DevicePropertyLookup,
	DevicePropertyTargetDto,
	checkPropertyTarget,
	describeCommandValueProblem,
	describeValueMismatch,
	devicePropertyReferences,
	findPropertyForCheck,
	isWritable,
} from './device-property.utils';
import { automationIntentContext } from './intent-context.utils';

export const SECURITY_ARM_NODE_TYPE = 'security.arm';

/**
 * The states the action can arm to. Disarming is not among them: an automation acts without a person
 * present and may not reduce safety (design § Security and safety, ADR 0003 decision 18).
 */
export const SECURITY_ARM_STATES = [ArmedState.ARMED_HOME, ArmedState.ARMED_AWAY, ArmedState.ARMED_NIGHT] as const;

export type SecurityArmState = (typeof SECURITY_ARM_STATES)[number];

export class SecurityArmConfigDto extends DevicePropertyTargetDto {
	@IsIn(SECURITY_ARM_STATES, {
		message: `[{"field":"armed_state","reason":"The alarm can be armed to ${SECURITY_ARM_STATES.join(', ')}."}]`,
	})
	armed_state: SecurityArmState;
}

export interface SecurityArmDependencies {
	commands: DevicePropertyCommander;
	findProperty: DevicePropertyLookup;
}

const describeError = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

/**
 * The action "arm the alarm".
 *
 * It writes the armed state to the `state` property of the `alarm` channel of an alarm device, through
 * `PropertyCommandService` as every device write of an automation does, with the automation as the origin
 * of the intent. It declares the write with `commands()`, so the safety policy judges it like any other
 * write; arming is allowed.
 *
 * There is no disarm action: an automation may not disarm the alarm (ADR 0003, decision 18), and a write
 * of `disarmed` through "Set device value" is refused by the same policy.
 */
export const createSecurityArmNodeType = (
	dependencies: SecurityArmDependencies,
): AutomationActionNodeType<SecurityArmConfigDto> => {
	const validateShape = createConfigValidatorFromDto(SecurityArmConfigDto);

	const validateConfig: AutomationNodeConfigValidator = async (config) => {
		const shape = await validateShape(config);

		if (shape.length > 0) return shape;

		const typed = config as unknown as SecurityArmConfigDto;
		const property = await findPropertyForCheck(dependencies.findProperty, typed.property_id);

		if (!property) return [];

		const problems = checkPropertyTarget(property, typed);

		const channelCategory = property.channelCategory ?? null;
		const category = property.category ?? null;
		const notAlarm =
			(channelCategory !== null && channelCategory !== (ChannelCategory.ALARM as string)) ||
			(category !== null && category !== (PropertyCategory.STATE as string));

		if (notAlarm) {
			problems.push({ field: 'property_id', reason: 'This property is not the armed state of an alarm.' });

			return problems;
		}

		if (!isWritable(property)) {
			problems.push({ field: 'property_id', reason: 'This property can not be set.' });

			return problems;
		}

		const mismatch =
			describeValueMismatch(property, typed.armed_state) ?? describeCommandValueProblem(property, typed.armed_state);

		if (mismatch) problems.push({ field: 'armed_state', reason: mismatch });

		return problems;
	};

	return {
		type: SECURITY_ARM_NODE_TYPE,
		kind: 'action',
		name: 'Arm alarm',
		description: 'Arms an alarm: home, away or night. An automation can not disarm it.',
		validateConfig,
		configSchema: {
			type: 'object',
			properties: {
				...DEVICE_PROPERTY_TARGET_SCHEMA,
				device_id: { type: 'string', format: 'uuid', description: 'The alarm device.' },
				channel_id: { type: 'string', format: 'uuid', description: 'The alarm channel of the device.' },
				property_id: { type: 'string', format: 'uuid', description: 'The armed state property of the channel.' },
				armed_state: { type: 'string', enum: [...SECURITY_ARM_STATES], description: 'The state to arm to.' },
			},
			required: ['device_id', 'channel_id', 'property_id', 'armed_state'],
			additionalProperties: false,
		},
		references: devicePropertyReferences,
		commands: (config) =>
			typeof config?.property_id === 'string'
				? [
						{
							kind: 'property_write',
							propertyId: config.property_id,
							value: config.armed_state,
							field: 'armed_state',
						},
					]
				: [],
		execute: async (config, context) => {
			if (context.signal.aborted) {
				return { success: false, reason: 'The run was cancelled before the alarm was armed.' };
			}

			try {
				const result = await dependencies.commands.executePropertyCommands(
					[
						{
							propertyId: config.property_id,
							value: config.armed_state,
							requestedDeviceId: config.device_id,
							requestedChannelId: config.channel_id,
						},
					],
					{ context: automationIntentContext(context) },
				);

				const refused = result.results.find((item) => !item.success);

				if (result.success && !refused) return { success: true };

				return { success: false, reason: refused?.reason ?? 'The alarm refused the armed state.' };
			} catch (error) {
				return { success: false, reason: describeError(error) };
			}
		},
	};
};
