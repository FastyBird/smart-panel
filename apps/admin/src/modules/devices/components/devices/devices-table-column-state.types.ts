import type { IDevicesFilter } from '../../composables/types';
import type { IDevice } from '../../store/devices.store.types';

export interface IDevicesTableColumnStateProps {
	device: IDevice;
	filters: IDevicesFilter;
}
