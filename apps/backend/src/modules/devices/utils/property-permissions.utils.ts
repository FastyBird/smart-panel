import { PermissionType } from '../devices.constants';

/** Read/write permission includes either direction, while event permission is independent. */
export function permissionSatisfied(required: PermissionType, permissions: ReadonlySet<PermissionType>): boolean {
	return (
		permissions.has(required) ||
		((required === PermissionType.READ_ONLY || required === PermissionType.WRITE_ONLY) &&
			permissions.has(PermissionType.READ_WRITE))
	);
}
