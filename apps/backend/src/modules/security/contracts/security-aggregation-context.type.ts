import { DeviceEntity } from '../../devices/entities/devices.entity';
import { ArmedState } from '../security.constants';

export interface SecurityAggregationContext {
	armedState?: ArmedState | null;
	devices?: DeviceEntity[];
}
