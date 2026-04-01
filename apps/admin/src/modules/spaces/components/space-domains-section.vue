<template>
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
		<space-domain-card
			v-for="domain in domains"
			:key="domain.key"
			:icon="domain.icon"
			:icon-color="domain.iconColor"
			:title="domain.title"
			:description="domain.description"
			:tags="domain.tags"
			:loading="domain.loading"
			@click="domain.openDialog()"
		/>
	</div>

	<!-- Lighting roles dialog -->
	<space-lighting-roles-dialog
		v-model:visible="showLightingRolesDialog"
		:space="props.space"
		@roles-changed="onLightingRolesChanged"
	/>

	<!-- Climate roles dialog -->
	<space-climate-roles-dialog
		v-model:visible="showClimateRolesDialog"
		:space="props.space"
		@roles-changed="onClimateRolesChanged"
	/>

	<!-- Covers roles dialog -->
	<space-covers-roles-dialog
		v-model:visible="showCoversRolesDialog"
		:space="props.space"
		@roles-changed="onCoversRolesChanged"
	/>

	<!-- Sensor roles dialog -->
	<space-sensor-roles-dialog
		v-model:visible="showSensorRolesDialog"
		:space="props.space"
		@roles-changed="onSensorRolesChanged"
	/>

	<!-- Media activities dialog -->
	<space-media-activities-dialog
		v-model:visible="showMediaActivitiesDialog"
		:space="props.space"
		@bindings-changed="onMediaActivitiesChanged"
	/>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import {
	getActivityColor,
	getActivityIcon,
	MediaActivityKey,
	useSpaceMedia,
} from '../composables/useSpaceMedia';
import { useSpacesRefreshSignals } from '../composables';
import {
	ClimateRole,
	CoversRole,
	LightingRole,
	SENSOR_ROLE_ORDER,
	SensorRole,
	SPACES_MODULE_PREFIX,
} from '../spaces.constants';

import SpaceDomainCard from './space-domain-card.vue';
import SpaceClimateRolesDialog from './space-climate-roles-dialog.vue';
import SpaceCoversRolesDialog from './space-covers-roles-dialog.vue';
import SpaceLightingRolesDialog from './space-lighting-roles-dialog.vue';
import SpaceMediaActivitiesDialog from './space-media-activities-dialog.vue';
import SpaceSensorRolesDialog from './space-sensor-roles-dialog.vue';

import type { IDomainTag } from './space-domain-card.types';
import type { ISpaceDomainsSectionProps } from './space-domains-section.types';

defineOptions({
	name: 'SpaceDomainsSection',
});

const props = defineProps<ISpaceDomainsSectionProps>();

const { t } = useI18n();
const backend = useBackend();
const { lightingSignal, climateSignal, coversSignal, sensorSignal } = useSpacesRefreshSignals();

// Dialog visibility
const showLightingRolesDialog = ref(false);
const showClimateRolesDialog = ref(false);
const showCoversRolesDialog = ref(false);
const showSensorRolesDialog = ref(false);
const showMediaActivitiesDialog = ref(false);

// ── Lighting ────────────────────────────────────────────────

const lightingLoading = ref(false);
const lightingTags = ref<IDomainTag[]>([]);

const getLightingRoleTagType = (role: string): IDomainTag['type'] => {
	switch (role) {
		case LightingRole.main:
			return 'primary';
		case LightingRole.task:
			return 'warning';
		case LightingRole.ambient:
			return 'success';
		case LightingRole.accent:
			return 'danger';
		case LightingRole.night:
		default:
			return 'info';
	}
};

const getLightingRoleIcon = (role: string): string => {
	switch (role) {
		case LightingRole.main:
			return 'mdi:lightbulb';
		case LightingRole.task:
			return 'mdi:desk-lamp';
		case LightingRole.ambient:
			return 'mdi:lightbulb-group';
		case LightingRole.accent:
			return 'mdi:spotlight-beam';
		case LightingRole.night:
			return 'mdi:weather-night';
		default:
			return 'mdi:lightbulb-outline';
	}
};

const loadLightingRoles = async (): Promise<void> => {
	if (!props.space?.id) return;

	lightingLoading.value = true;

	try {
		const { data: responseData, error } = await backend.client.GET(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/lighting/targets`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			lightingTags.value = [];
			return;
		}

		const targets = responseData.data ?? [];
		const roleMap = new Map<string, number>();

		for (const target of targets) {
			if (!target.role) continue;

			const role = target.role as string;
			roleMap.set(role, (roleMap.get(role) ?? 0) + 1);
		}

		const roleOrder = [LightingRole.main, LightingRole.task, LightingRole.ambient, LightingRole.accent, LightingRole.night, LightingRole.other];

		lightingTags.value = Array.from(roleMap.entries())
			.sort(([a], [b]) => roleOrder.indexOf(a as LightingRole) - roleOrder.indexOf(b as LightingRole))
			.map(([role, count]) => ({
				label: t(`spacesModule.lightingRoles.${role}`),
				type: getLightingRoleTagType(role),
				icon: getLightingRoleIcon(role),
				count,
			}));
	} finally {
		lightingLoading.value = false;
	}
};

// ── Climate ─────────────────────────────────────────────────

const climateLoading = ref(false);
const climateTags = ref<IDomainTag[]>([]);

const getClimateRoleTagType = (role: string): IDomainTag['type'] => {
	switch (role) {
		case ClimateRole.heating_only:
			return 'danger';
		case ClimateRole.cooling_only:
			return 'primary';
		case ClimateRole.auto:
			return 'success';
		case ClimateRole.auxiliary:
			return 'warning';
		default:
			return 'info';
	}
};

const getClimateRoleIcon = (role: string): string => {
	switch (role) {
		case ClimateRole.heating_only:
			return 'mdi:fire';
		case ClimateRole.cooling_only:
			return 'mdi:snowflake';
		case ClimateRole.auto:
			return 'mdi:thermostat-auto';
		case ClimateRole.auxiliary:
			return 'mdi:radiator';
		case ClimateRole.sensor:
			return 'mdi:thermometer';
		default:
			return 'mdi:eye-off';
	}
};

const loadClimateRoles = async (): Promise<void> => {
	if (!props.space?.id) return;

	climateLoading.value = true;

	try {
		const { data: responseData, error } = await backend.client.GET(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/climate/targets`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			climateTags.value = [];
			return;
		}

		const targets = responseData.data ?? [];
		const roleMap = new Map<string, number>();

		for (const target of targets) {
			if (!target.role || (target.role as string) === ClimateRole.hidden) continue;

			const role = target.role as string;
			roleMap.set(role, (roleMap.get(role) ?? 0) + 1);
		}

		const roleOrder = [ClimateRole.heating_only, ClimateRole.cooling_only, ClimateRole.auto, ClimateRole.auxiliary, ClimateRole.sensor];

		climateTags.value = Array.from(roleMap.entries())
			.sort(([a], [b]) => roleOrder.indexOf(a as ClimateRole) - roleOrder.indexOf(b as ClimateRole))
			.map(([role, count]) => ({
				label: t(`spacesModule.climateRoles.${role}`),
				type: getClimateRoleTagType(role),
				icon: getClimateRoleIcon(role),
				count,
			}));
	} finally {
		climateLoading.value = false;
	}
};

// ── Covers ──────────────────────────────────────────────────

const coversLoading = ref(false);
const coversTags = ref<IDomainTag[]>([]);

const getCoversRoleTagType = (role: string): IDomainTag['type'] => {
	switch (role) {
		case CoversRole.primary:
			return 'primary';
		case CoversRole.blackout:
			return 'danger';
		case CoversRole.sheer:
			return 'success';
		case CoversRole.outdoor:
			return 'warning';
		default:
			return 'info';
	}
};

const getCoversRoleIcon = (role: string): string => {
	switch (role) {
		case CoversRole.primary:
			return 'mdi:blinds';
		case CoversRole.blackout:
			return 'mdi:blinds-horizontal-closed';
		case CoversRole.sheer:
			return 'mdi:curtains';
		case CoversRole.outdoor:
			return 'mdi:window-shutter';
		default:
			return 'mdi:blinds-horizontal';
	}
};

const loadCoversRoles = async (): Promise<void> => {
	if (!props.space?.id) return;

	coversLoading.value = true;

	try {
		const { data: responseData, error } = await backend.client.GET(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/covers/targets`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			coversTags.value = [];
			return;
		}

		const targets = responseData.data ?? [];
		const roleMap = new Map<string, number>();

		for (const target of targets) {
			if (!target.role) continue;

			const role = target.role as string;
			roleMap.set(role, (roleMap.get(role) ?? 0) + 1);
		}

		const roleOrder = [CoversRole.primary, CoversRole.blackout, CoversRole.sheer, CoversRole.outdoor, CoversRole.hidden];

		coversTags.value = Array.from(roleMap.entries())
			.sort(([a], [b]) => roleOrder.indexOf(a as CoversRole) - roleOrder.indexOf(b as CoversRole))
			.map(([role, count]) => ({
				label: t(`spacesModule.coversRoles.${role}`),
				type: getCoversRoleTagType(role),
				icon: getCoversRoleIcon(role),
				count,
			}));
	} finally {
		coversLoading.value = false;
	}
};

// ── Sensor ──────────────────────────────────────────────────

const sensorLoading = ref(false);
const sensorTags = ref<IDomainTag[]>([]);

const getSensorRoleTagType = (role: string): IDomainTag['type'] => {
	switch (role) {
		case SensorRole.ENVIRONMENT:
			return 'success';
		case SensorRole.SAFETY:
			return 'danger';
		case SensorRole.SECURITY:
			return 'warning';
		case SensorRole.AIR_QUALITY:
			return 'info';
		case SensorRole.ENERGY:
			return 'primary';
		default:
			return 'info';
	}
};

const getSensorRoleIcon = (role: string): string => {
	switch (role) {
		case SensorRole.ENVIRONMENT:
			return 'mdi:thermometer';
		case SensorRole.SAFETY:
			return 'mdi:shield-alert';
		case SensorRole.SECURITY:
			return 'mdi:motion-sensor';
		case SensorRole.AIR_QUALITY:
			return 'mdi:air-filter';
		case SensorRole.ENERGY:
			return 'mdi:lightning-bolt';
		default:
			return 'mdi:chart-line';
	}
};

const loadSensorRoles = async (): Promise<void> => {
	if (!props.space?.id) return;

	sensorLoading.value = true;

	try {
		const { data: responseData, error } = await backend.client.GET(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/sensors/targets`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			sensorTags.value = [];
			return;
		}

		const targets = responseData.data ?? [];
		const roleMap = new Map<string, number>();

		for (const target of targets) {
			if (!target.role || (target.role as string) === SensorRole.HIDDEN) continue;

			const role = target.role as string;
			roleMap.set(role, (roleMap.get(role) ?? 0) + 1);
		}

		sensorTags.value = Array.from(roleMap.entries())
			.sort(([a], [b]) => SENSOR_ROLE_ORDER.indexOf(a as SensorRole) - SENSOR_ROLE_ORDER.indexOf(b as SensorRole))
			.map(([role, count]) => ({
				label: t(`spacesModule.sensorRoles.${role}`),
				type: getSensorRoleTagType(role),
				icon: getSensorRoleIcon(role),
				count,
			}));
	} finally {
		sensorLoading.value = false;
	}
};

// ── Media ───────────────────────────────────────────────────

const spaceIdRef = computed(() => props.space?.id);
const { fetchEndpoints, fetchBindings, findBindingByActivity } = useSpaceMedia(spaceIdRef);

const mediaLoading = ref(false);
const mediaTags = ref<IDomainTag[]>([]);

const activityKeys = [MediaActivityKey.watch, MediaActivityKey.listen, MediaActivityKey.gaming, MediaActivityKey.background];

const loadMediaActivities = async (): Promise<void> => {
	if (!props.space?.id) return;

	mediaLoading.value = true;

	try {
		await Promise.all([fetchEndpoints(), fetchBindings()]);

		const tags: IDomainTag[] = [];

		for (const key of activityKeys) {
			const binding = findBindingByActivity(key);
			if (!binding) continue;

			const routeCount = [binding.displayEndpointId, binding.audioEndpointId, binding.sourceEndpointId, binding.remoteEndpointId].filter(Boolean).length;

			tags.push({
				label: t(`spacesModule.media.activityLabels.${key}`),
				type: getActivityColor(key),
				icon: getActivityIcon(key),
				count: routeCount,
			});
		}

		mediaTags.value = tags;
	} catch {
		mediaTags.value = [];
	} finally {
		mediaLoading.value = false;
	}
};

// ── Domain config array ─────────────────────────────────────

const domains = computed(() => [
	{
		key: 'lighting',
		icon: 'mdi:lightbulb',
		iconColor: 'warning' as const,
		title: t('spacesModule.detail.domains.lighting.title'),
		description: t('spacesModule.detail.domains.lighting.description'),
		tags: lightingTags.value,
		loading: lightingLoading.value,
		openDialog: () => {
			showLightingRolesDialog.value = true;
		},
	},
	{
		key: 'climate',
		icon: 'mdi:thermostat',
		iconColor: 'danger' as const,
		title: t('spacesModule.detail.domains.climate.title'),
		description: t('spacesModule.detail.domains.climate.description'),
		tags: climateTags.value,
		loading: climateLoading.value,
		openDialog: () => {
			showClimateRolesDialog.value = true;
		},
	},
	{
		key: 'covers',
		icon: 'mdi:blinds',
		iconColor: 'primary' as const,
		title: t('spacesModule.detail.domains.covers.title'),
		description: t('spacesModule.detail.domains.covers.description'),
		tags: coversTags.value,
		loading: coversLoading.value,
		openDialog: () => {
			showCoversRolesDialog.value = true;
		},
	},
	{
		key: 'sensor',
		icon: 'mdi:chart-bell-curve',
		iconColor: 'success' as const,
		title: t('spacesModule.detail.domains.sensor.title'),
		description: t('spacesModule.detail.domains.sensor.description'),
		tags: sensorTags.value,
		loading: sensorLoading.value,
		openDialog: () => {
			showSensorRolesDialog.value = true;
		},
	},
	{
		key: 'media',
		icon: 'mdi:play-box-multiple',
		iconColor: 'info' as const,
		title: t('spacesModule.detail.domains.media.title'),
		description: t('spacesModule.detail.domains.media.description'),
		tags: mediaTags.value,
		loading: mediaLoading.value,
		openDialog: () => {
			showMediaActivitiesDialog.value = true;
		},
	},
]);

// ── Data loading ────────────────────────────────────────────

const loadAll = (): void => {
	loadLightingRoles();
	loadClimateRoles();
	loadCoversRoles();
	loadSensorRoles();
	loadMediaActivities();
};

// ── Refresh signal watchers ─────────────────────────────────

watch(() => lightingSignal?.value, () => {
	if (props.space?.id) loadLightingRoles();
});

watch(() => climateSignal?.value, () => {
	if (props.space?.id) loadClimateRoles();
});

watch(() => coversSignal?.value, () => {
	if (props.space?.id) loadCoversRoles();
});

watch(() => sensorSignal?.value, () => {
	if (props.space?.id) loadSensorRoles();
});

watch(
	() => props.space?.id,
	(newId) => {
		if (newId) loadAll();
	}
);

// ── Dialog handlers ─────────────────────────────────────────

const onLightingRolesChanged = (): void => {
	loadLightingRoles();
};

const onClimateRolesChanged = (): void => {
	loadClimateRoles();
};

const onCoversRolesChanged = (): void => {
	loadCoversRoles();
};

const onSensorRolesChanged = (): void => {
	loadSensorRoles();
};

const onMediaActivitiesChanged = (): void => {
	loadMediaActivities();
};

// ── Lifecycle ───────────────────────────────────────────────

onMounted(() => {
	if (props.space?.id) loadAll();
});

defineExpose({
	reload: loadAll,
});
</script>
