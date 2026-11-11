import type { IDevice } from '../../../../modules/devices';
import type { IModbusEndpoint, IModbusEndpointHealth } from '../../store/endpoints.types';

export interface IModbusEndpointsTableProps {
	endpoints: IModbusEndpoint[];
	health: Record<string, IModbusEndpointHealth>;
	devices: IDevice[];
}
