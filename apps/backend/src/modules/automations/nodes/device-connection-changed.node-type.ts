import { IsIn, IsOptional, IsUUID } from 'class-validator';

import { AutomationTriggerNodeType } from '../graph/node-type';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

import { DeviceConnectionChange } from './bus-events.types';

export const DEVICE_CONNECTION_CHANGED_NODE_TYPE = 'device.connection.changed';

export const DEVICE_CONNECTIONS = ['online', 'offline'] as const;

export type DeviceConnection = (typeof DEVICE_CONNECTIONS)[number];

export class DeviceConnectionChangedConfigDto {
	@IsUUID('4', { message: '[{"field":"device_id","reason":"A device must be chosen."}]' })
	device_id: string;

	/** Start only when the device goes online, or only when it goes offline; left out for both */
	@IsOptional()
	@IsIn(DEVICE_CONNECTIONS, { message: '[{"field":"to","reason":"\\"to\\" must be online or offline."}]' })
	to?: DeviceConnection;
}

/** The part of the event source the trigger needs */
export interface DeviceConnectionSource {
	/**
	 * Calls `listener` whenever the device goes from online to offline or back; never for the state it is in
	 * when the watch starts, and never for a change between two online or two offline states.
	 */
	onDeviceConnection(deviceId: string, listener: (change: DeviceConnectionChange) => void): () => void;
}

const connectionOf = (online: boolean): DeviceConnection => (online ? 'online' : 'offline');

/**
 * The trigger "a device goes offline or online".
 *
 * It fires on a transition only (design § Trigger semantics): a device that keeps reporting that it is
 * online, or that moves between two online states such as `init` and `ready`, starts nothing, and neither
 * does the state the device is in when the backend starts or the automation is saved. A device that
 * reports no connection state, or `unknown`, is neither online nor offline.
 */
export const createDeviceConnectionChangedNodeType = (
	source: DeviceConnectionSource,
): AutomationTriggerNodeType<DeviceConnectionChangedConfigDto> => ({
	type: DEVICE_CONNECTION_CHANGED_NODE_TYPE,
	kind: 'trigger',
	name: 'Device goes offline or online',
	description: 'Starts when a device loses its connection, when it comes back, or both.',
	validateConfig: createConfigValidatorFromDto(DeviceConnectionChangedConfigDto),
	configSchema: {
		type: 'object',
		properties: {
			device_id: { type: 'string', format: 'uuid', description: 'The device to watch.' },
			to: {
				type: 'string',
				enum: [...DEVICE_CONNECTIONS],
				description: 'Start only when the device goes online, or only when it goes offline. Left out means both.',
			},
		},
		required: ['device_id'],
		additionalProperties: false,
	},
	references: (config) => (typeof config.device_id === 'string' ? [{ kind: 'device', id: config.device_id }] : []),
	subscribe: (config, fire) =>
		source.onDeviceConnection(config.device_id, (change) => {
			if (change.deviceId !== config.device_id) return;

			const to = connectionOf(change.online);

			if (config.to !== undefined && config.to !== null && config.to !== to) return;

			fire({ device_id: change.deviceId, from: connectionOf(!change.online), to, state: change.state });
		}),
});
