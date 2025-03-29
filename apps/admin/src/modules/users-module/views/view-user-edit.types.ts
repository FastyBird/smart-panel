import type { IUser } from '../store';

export interface IViewUserEditProps {
	id: IUser['id'];
	remoteFormChanged?: boolean;
}
