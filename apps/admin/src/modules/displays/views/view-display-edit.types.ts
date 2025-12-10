import type { IDisplay } from '../store/displays.store.types';

export interface IViewDisplayEditProps {
	id: IDisplay['id'];
	remoteFormChanged?: boolean;
}
