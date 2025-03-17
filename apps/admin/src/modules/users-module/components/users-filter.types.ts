import type { UserRole } from '../users.constants';

export interface IUsersFilterFields {
	search: string;
	role: UserRole | string;
}

export interface IUsersFilterProps {
	filters: IUsersFilterFields;
	remoteFormReset?: boolean;
}
