import {
	ArrayMaxSize,
	ArrayMinSize,
	ArrayUnique,
	IsArray,
	IsNotEmpty,
	IsOptional,
	IsString,
	MaxLength,
} from 'class-validator';

import { DataTypeType, PermissionType } from '../../devices/devices.constants';
import {
	AutomationNodeConfigProblem,
	AutomationNodeConfigValidator,
	AutomationTriggerNodeType,
} from '../graph/node-type';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

import { ButtonOccurrence } from './bus-events.types';
import {
	DEVICE_PROPERTY_TARGET_SCHEMA,
	DevicePropertyLookup,
	DevicePropertyTargetDto,
	checkPropertyTarget,
	devicePropertyReferences,
	findPropertyForCheck,
} from './device-property.utils';

export const DEVICE_BUTTON_PRESSED_NODE_TYPE = 'device.button.pressed';

/** The most gestures one trigger listens for */
export const DEVICE_BUTTON_MAX_EVENTS = 20;

/** The longest name of a gesture */
export const DEVICE_BUTTON_EVENT_MAX_LENGTH = 64;

const EVENTS_REASON = `The presses must be a list of 1 to ${DEVICE_BUTTON_MAX_EVENTS} different, non-empty texts.`;

export class DeviceButtonPressedConfigDto extends DevicePropertyTargetDto {
	/** The gestures to start on, e.g. `press` or `long_press`; left out for every gesture */
	@IsOptional()
	@IsArray({ message: JSON.stringify([{ field: 'events', reason: EVENTS_REASON }]) })
	@ArrayMinSize(1, { message: JSON.stringify([{ field: 'events', reason: EVENTS_REASON }]) })
	@ArrayMaxSize(DEVICE_BUTTON_MAX_EVENTS, { message: JSON.stringify([{ field: 'events', reason: EVENTS_REASON }]) })
	@ArrayUnique({ message: JSON.stringify([{ field: 'events', reason: EVENTS_REASON }]) })
	@IsString({ each: true, message: JSON.stringify([{ field: 'events', reason: EVENTS_REASON }]) })
	@IsNotEmpty({ each: true, message: JSON.stringify([{ field: 'events', reason: EVENTS_REASON }]) })
	@MaxLength(DEVICE_BUTTON_EVENT_MAX_LENGTH, {
		each: true,
		message: JSON.stringify([{ field: 'events', reason: EVENTS_REASON }]),
	})
	events?: string[];
}

/** The part of the event source the trigger needs */
export interface ButtonOccurrenceSource {
	onButtonOccurrence(listener: (occurrence: ButtonOccurrence) => void): () => void;
}

export interface DeviceButtonPressedDependencies {
	source: ButtonOccurrenceSource;
	findProperty: DevicePropertyLookup;
}

/** Button occurrences are reported on a property that is read-only or that only carries events */
const reportsOccurrences = (permissions: PermissionType[]): boolean =>
	permissions.includes(PermissionType.EVENT_ONLY) || permissions.includes(PermissionType.READ_ONLY);

/**
 * The trigger "a button is pressed".
 *
 * It starts on every `DevicesModule.ChannelInput.Occurrence` of the chosen property: a press, a long press,
 * a double press - whatever gestures the integration reports. `events` narrows it to some of them. A press
 * is an event and not a state, so every occurrence starts a run, also the same gesture twice in a row; the
 * devices module has already dropped what a transport delivered twice.
 */
export const createDeviceButtonPressedNodeType = (
	dependencies: DeviceButtonPressedDependencies,
): AutomationTriggerNodeType<DeviceButtonPressedConfigDto> => {
	const validateShape = createConfigValidatorFromDto(DeviceButtonPressedConfigDto);

	const validateConfig: AutomationNodeConfigValidator = async (config) => {
		const shape = await validateShape(config);

		if (shape.length > 0) return shape;

		const typed = config as unknown as DeviceButtonPressedConfigDto;
		const property = await findPropertyForCheck(dependencies.findProperty, typed.property_id);

		if (!property) return [];

		const problems: AutomationNodeConfigProblem[] = checkPropertyTarget(property, typed);

		if (!reportsOccurrences(property.permissions)) {
			problems.push({ field: 'property_id', reason: 'This property does not report button presses.' });

			return problems;
		}

		const known =
			property.dataType === DataTypeType.ENUM && Array.isArray(property.format) && property.format.length > 0
				? property.format.map((item) => String(item))
				: null;

		if (known) {
			(typed.events ?? []).forEach((event, index) => {
				if (!known.includes(event)) {
					problems.push({ field: `events.${index}`, reason: 'This button does not report this press.' });
				}
			});
		}

		return problems;
	};

	return {
		type: DEVICE_BUTTON_PRESSED_NODE_TYPE,
		kind: 'trigger',
		name: 'Button is pressed',
		description: 'Starts when a button is pressed: any press, or only the presses chosen, such as a long press.',
		validateConfig,
		configSchema: {
			type: 'object',
			properties: {
				...DEVICE_PROPERTY_TARGET_SCHEMA,
				property_id: { type: 'string', format: 'uuid', description: 'The property the button reports its presses on.' },
				events: {
					type: 'array',
					items: { type: 'string', minLength: 1, maxLength: DEVICE_BUTTON_EVENT_MAX_LENGTH },
					minItems: 1,
					maxItems: DEVICE_BUTTON_MAX_EVENTS,
					uniqueItems: true,
					description:
						'Start only on these presses, e.g. "press", "long_press" or "double_press". Left out means every press.',
				},
			},
			required: ['device_id', 'channel_id', 'property_id'],
			additionalProperties: false,
		},
		references: devicePropertyReferences,
		subscribe: (config, fire) => {
			const events = Array.isArray(config.events) && config.events.length > 0 ? [...config.events] : null;

			return dependencies.source.onButtonOccurrence((occurrence) => {
				if (occurrence.propertyId !== config.property_id) return;
				if (events && !events.includes(occurrence.event)) return;

				fire({
					device_id: occurrence.deviceId,
					channel_id: occurrence.channelId,
					property_id: occurrence.propertyId,
					event: occurrence.event,
					occurrence_id: occurrence.id,
				});
			});
		},
	};
};
