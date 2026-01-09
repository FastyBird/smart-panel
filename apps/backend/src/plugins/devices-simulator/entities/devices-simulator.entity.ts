import { Expose } from 'class-transformer';
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
	@Column({ default: false })
	autoSimulate: boolean;

	@ApiProperty({
		description: 'Simulation interval in milliseconds (when auto_simulate is true)',
		name: 'simulate_interval',
		type: 'number',
		example: 5000,
	})
	@Expose({ name: 'simulate_interval' })
	@Column({ default: 5000 })
	simulateInterval: number;

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
