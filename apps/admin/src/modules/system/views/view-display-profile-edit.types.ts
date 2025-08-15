import type { IDisplayProfile } from '../store/displays-profiles.store.types';

export interface IViewDisplayProfileEditProps {
	display: IDisplayProfile['id'];
	remoteFormChanged?: boolean;
}
