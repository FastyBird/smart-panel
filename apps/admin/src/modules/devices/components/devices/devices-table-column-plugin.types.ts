import type { IDevicesFilter } from '../../composables/composables';
import type { IDevice } from '../../store/devices.store.types';

export interface IDevicesTableColumnPluginProps {
	device: IDevice;
	filters: IDevicesFilter;
}
