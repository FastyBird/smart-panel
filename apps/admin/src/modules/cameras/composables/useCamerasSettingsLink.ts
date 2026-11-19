import { type ComputedRef, computed } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

import { UsersModuleUserRole } from '../../../openapi.constants';
import { useSession } from '../../auth/composables/useSession';
import { RouteNames as ConfigRouteNames } from '../../config/config.constants';
import { CAMERAS_MODULE_NAME } from '../cameras.constants';

export interface IUseCamerasSettingsLink {
	/** Only admins and owners may open the module settings. */
	canOpenSettings: ComputedRef<boolean>;
	settingsRoute: RouteLocationRaw;
}

export const useCamerasSettingsLink = (): IUseCamerasSettingsLink => {
	const { profile } = useSession();

	const canOpenSettings = computed<boolean>(
		() => profile.value?.role === UsersModuleUserRole.admin || profile.value?.role === UsersModuleUserRole.owner
	);

	return {
		canOpenSettings,
		settingsRoute: { name: ConfigRouteNames.CONFIG_MODULE_EDIT, params: { module: CAMERAS_MODULE_NAME } },
	};
};
