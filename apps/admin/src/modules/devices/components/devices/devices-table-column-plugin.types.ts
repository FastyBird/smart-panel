import type { IDevicesFilter } from '../../composables';
import type { IDevice } from '../../store';

export interface IDevicesTableColumnPluginProps {
	device: IDevice;
	filters: IDevicesFilter;
}
