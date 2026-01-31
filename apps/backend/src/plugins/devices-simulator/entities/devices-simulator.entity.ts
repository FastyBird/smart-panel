import { Expose, Transform } from 'class-transformer';
import { ChildEntity, Column } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_SIMULATOR_TYPE } from '../devices-simulator.constants';

@ApiSchema({ name: 'DevicesSimulatorPluginDataDevice' })
@ChildEntity()
export class SimulatorDeviceEntity extends DeviceEntity {
	@ApiProperty({
		description: 'Whether to auto-simulate value changes',
		name: 'auto_simulate',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'auto_simulate' })
	@Transform(
		({ obj }: { obj: { auto_simulate?: boolean; autoSimulate?: boolean } }) => obj.auto_simulate ?? obj.autoSimulate,
		{ toClassOnly: true },
	)
	@Column({ default: false })
	autoSimulate: boolean;

	@ApiProperty({
		description: 'Simulation interval in milliseconds (when auto_simulate is true)',
		name: 'simulate_interval',
		type: 'number',
		example: 5000,
	})
	@Expose({ name: 'simulate_interval' })
	@Transform(
		({ obj }: { obj: { simulate_interval?: number; simulateInterval?: number } }) =>
			obj.simulate_interval ?? obj.simulateInterval,
		{ toClassOnly: true },
	)
	@Column({ default: 5000 })
	simulateInterval: number;

	@ApiProperty({
		description: 'Simulation behavior mode: default (timer-based random) or realistic (reacts to user commands)',
		name: 'behavior_mode',
		type: 'string',
		enum: ['default', 'realistic'],
		default: 'default',
		example: 'default',
	})
	@Expose({ name: 'behavior_mode' })
	@Transform(
		({ obj }: { obj: { behavior_mode?: string; behaviorMode?: string } }) =>
			obj.behavior_mode ?? obj.behaviorMode,
		{ toClassOnly: true },
	)
	@Column({ default: 'default' })
	behaviorMode: string;

	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_SIMULATOR_TYPE,
		example: DEVICES_SIMULATOR_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_SIMULATOR_TYPE;
	}
}

@ApiSchema({ name: 'DevicesSimulatorPluginDataChannel' })
@ChildEntity()
export class SimulatorChannelEntity extends ChannelEntity {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_SIMULATOR_TYPE,
		example: DEVICES_SIMULATOR_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_SIMULATOR_TYPE;
	}
}

@ApiSchema({ name: 'DevicesSimulatorPluginDataChannelProperty' })
@ChildEntity()
export class SimulatorChannelPropertyEntity extends ChannelPropertyEntity {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_SIMULATOR_TYPE,
		example: DEVICES_SIMULATOR_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_SIMULATOR_TYPE;
	}
}
