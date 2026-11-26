import type { StatusTagStatus } from '../../../common/components/status-tag.types';
import { UsersModuleUserRole } from '../../../openapi.constants';
import type { IUser } from '../store/users.store.types';

/**
 * The backend refuses to delete either of these, so offering them only produces a failure the operator can do nothing
 * about - and a bulk delete of "everything" would always report one. The same two rules the edit form applies to the
 * role field
 */
export const canRemoveUser = (user: IUser, currentUserId: IUser['id'] | null | undefined): boolean => {
	// Users cannot delete their own account
	if (typeof currentUserId === 'string' && currentUserId === user.id) {
		return false;
	}

	// The owner account cannot be deleted
	return user.role !== UsersModuleUserRole.owner;
};

/** The name shown for a user: first and last name when set, the username otherwise */
export const userDisplayName = (user: IUser): string => {
	const name = [user.firstName, user.lastName].filter((part) => typeof part === 'string' && part.trim() !== '').join(' ');

	return name !== '' ? name : user.username;
};

/** The role as a status tag: the owner stands out, admins are marked, everyone else is plain */
export const roleStatus = (role: IUser['role']): StatusTagStatus => {
	switch (role) {
		case UsersModuleUserRole.owner:
			return 'primary';
		case UsersModuleUserRole.admin:
			return 'warn';
		default:
			return 'info';
	}
};
