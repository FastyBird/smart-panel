import type { IUser } from '../store/users.store.types';

export interface IViewUserEditProps {
	id: IUser['id'];
	remoteFormChanged?: boolean;
}
