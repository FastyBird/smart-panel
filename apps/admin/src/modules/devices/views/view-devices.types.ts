import type { IDevice } from '../store/devices.store.types';

export interface IViewDevicesProps {
	id?: IDevice['id'];
	/**
	 * Plugin type contributed by the `wizard/:type` child route. This view never reads it — the
	 * parent route uses `props: true`, so every child param is handed here as well, and an
	 * undeclared one cannot be auto-inherited onto a fragment root. Declaring it keeps Vue from
	 * warning on every render, the same way `view-device` and `view-channel` declare the child
	 * params they do not read.
	 */
	type?: string;
}
