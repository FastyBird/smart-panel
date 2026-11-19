import { computed, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { UsersModuleUserRole } from '../../../openapi.constants';

import { useCamerasSettingsLink } from './useCamerasSettingsLink';

const role = ref<string | null>(null);

vi.mock('../../auth/composables/useSession', () => ({
	useSession: () => ({ profile: computed(() => (role.value === null ? null : { role: role.value })) }),
}));

describe('useCamerasSettingsLink', () => {
	it('lets only admins and owners open the module settings', () => {
		const { canOpenSettings } = useCamerasSettingsLink();

		for (const [value, expected] of [
			[UsersModuleUserRole.owner, true],
			[UsersModuleUserRole.admin, true],
			[UsersModuleUserRole.user, false],
			[null, false],
		] as const) {
			role.value = value;

			expect(canOpenSettings.value, String(value)).toBe(expected);
		}
	});

	it('points at the cameras module settings', () => {
		expect(useCamerasSettingsLink().settingsRoute).toEqual({ name: 'config_module-config_module_edit', params: { module: 'cameras-module' } });
	});
});
