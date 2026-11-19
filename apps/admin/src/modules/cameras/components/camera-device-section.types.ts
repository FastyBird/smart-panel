import type { IDevice } from '../../devices/store/devices.store.types';

export interface ICameraDeviceSectionProps {
	device: IDevice;
	/** `false` while the tab that holds the section is hidden: a running live view stops and snapshots pause. */
	active?: boolean;
}
