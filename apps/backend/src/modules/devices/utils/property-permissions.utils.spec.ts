import { PermissionType } from '../devices.constants';

import { permissionSatisfied } from './property-permissions.utils';

describe('property permission matching', () => {
	it.each([
		[PermissionType.READ_ONLY, PermissionType.READ_ONLY, true],
		[PermissionType.WRITE_ONLY, PermissionType.READ_ONLY, false],
		[PermissionType.READ_WRITE, PermissionType.READ_ONLY, false],
		[PermissionType.EVENT_ONLY, PermissionType.READ_ONLY, false],
		[PermissionType.READ_ONLY, PermissionType.WRITE_ONLY, false],
		[PermissionType.WRITE_ONLY, PermissionType.WRITE_ONLY, true],
		[PermissionType.READ_WRITE, PermissionType.WRITE_ONLY, false],
		[PermissionType.EVENT_ONLY, PermissionType.WRITE_ONLY, false],
		[PermissionType.READ_ONLY, PermissionType.READ_WRITE, true],
		[PermissionType.WRITE_ONLY, PermissionType.READ_WRITE, true],
		[PermissionType.READ_WRITE, PermissionType.READ_WRITE, true],
		[PermissionType.EVENT_ONLY, PermissionType.READ_WRITE, false],
		[PermissionType.READ_ONLY, PermissionType.EVENT_ONLY, false],
		[PermissionType.WRITE_ONLY, PermissionType.EVENT_ONLY, false],
		[PermissionType.READ_WRITE, PermissionType.EVENT_ONLY, false],
		[PermissionType.EVENT_ONLY, PermissionType.EVENT_ONLY, true],
	])('%s is satisfied by %s: %s', (required, available, expected) => {
		expect(permissionSatisfied(required, new Set([available]))).toBe(expected);
	});

	it('does not infer read/write capability from separately declared directions', () => {
		expect(
			permissionSatisfied(PermissionType.READ_WRITE, new Set([PermissionType.READ_ONLY, PermissionType.WRITE_ONLY])),
		).toBe(false);
	});
});
