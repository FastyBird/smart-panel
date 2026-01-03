<template>
	<el-card
		class="mt-2"
		body-class="p-0!"
	>
		<dl class="grid m-0">
			<dt
				class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
				style="background: var(--el-fill-color-light)"
			>
				{{ t('scenes.fields.category') }}
			</dt>
			<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center gap-2 min-w-[8rem]">
				<el-icon :size="18">
					<icon :icon="categoryIcon" />
				</el-icon>
				<el-text>
					{{ t(`scenes.categories.${scene.category}`) }}
				</el-text>
			</dd>

			<dt
				class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
				style="background: var(--el-fill-color-light)"
			>
				{{ t('scenes.fields.space') }}
			</dt>
			<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
				<el-text>
					{{ spaceName }}
				</el-text>
			</dd>

			<dt
				class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
				style="background: var(--el-fill-color-light)"
			>
				{{ t('scenes.fields.enabled') }}
			</dt>
			<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
				<el-tag
					:type="scene.enabled ? 'success' : 'danger'"
					size="small"
				>
					{{ scene.enabled ? t('scenes.filters.enabled.values.enabled') : t('scenes.filters.enabled.values.disabled') }}
				</el-tag>
			</dd>

			<dt
				class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
				style="background: var(--el-fill-color-light)"
			>
				{{ t('scenes.fields.actions') }}
			</dt>
			<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
				<el-text>
					<i18n-t
						keypath="scenes.texts.actionsCount"
						:plural="actions.length"
					>
						<template #count>
							<strong>{{ actions.length }}</strong>
						</template>
					</i18n-t>
				</el-text>
			</dd>

			<template v-if="scene.lastTriggeredAt">
				<dt
					class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
					style="background: var(--el-fill-color-light)"
				>
					{{ t('scenes.texts.lastTriggered') }}
				</dt>
				<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
					<el-text>
						{{ formatDate(scene.lastTriggeredAt) }}
					</el-text>
				</dd>
			</template>

			<template v-if="scene.description">
				<dt
					class="b-r b-r-solid py-3 px-2 flex items-center justify-end"
					style="background: var(--el-fill-color-light)"
				>
					{{ t('scenes.form.description') }}
				</dt>
				<dd class="col-start-2 m-0 p-2 flex items-center min-w-[8rem]">
					<el-text>
						{{ scene.description }}
					</el-text>
				</dd>
			</template>
		</dl>
	</el-card>

	<!-- Actions Section -->
	<el-card
		v-if="actions.length > 0"
		class="mt-4"
		body-class="p-0!"
		shadow="never"
	>
		<template #header>
			<div class="flex items-center gap-2">
				<el-icon :size="18">
					<icon icon="mdi:cog" />
				</el-icon>
				<span>{{ t('scenes.form.actionsSection') }}</span>
				<el-tag
					type="info"
					size="small"
				>
					{{ actions.length }}
				</el-tag>
			</div>
		</template>

		<el-table
			:data="actions"
			size="small"
			class="w-full"
		>
			<el-table-column
				:label="t('scenes.texts.order')"
				prop="order"
				:width="80"
				align="center"
			>
				<template #default="scope">
					{{ scope.row.order + 1 }}
				</template>
			</el-table-column>
			<el-table-column
				:label="t('scenes.form.device')"
				prop="deviceId"
			>
				<template #default="scope">
					{{ getDeviceName(getConfigValue(scope.row, 'device_id')) }}
				</template>
			</el-table-column>
			<el-table-column
				:label="t('scenes.form.property')"
				prop="propertyId"
			>
				<template #default="scope">
					{{ getPropertyName(getConfigValue(scope.row, 'property_id')) }}
				</template>
			</el-table-column>
			<el-table-column
				:label="t('scenes.form.value')"
				prop="value"
				:width="120"
			>
				<template #default="scope">
					<el-tag size="small">
						{{ formatValue(getConfigValue(scope.row, 'value')) }}
					</el-tag>
				</template>
			</el-table-column>
			<el-table-column
				:label="t('scenes.fields.enabled')"
				prop="enabled"
				:width="100"
				align="center"
			>
				<template #default="scope">
					<icon
						:icon="scope.row.enabled ? 'mdi:check-circle' : 'mdi:close-circle'"
						:class="scope.row.enabled ? 'text-success' : 'text-danger'"
						class="text-xl"
					/>
				</template>
			</el-table-column>
		</el-table>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { I18nT, useI18n } from 'vue-i18n';

import { ElCard, ElIcon, ElTable, ElTableColumn, ElTag, ElText } from 'element-plus';
import { Icon } from '@iconify/vue';

import { injectStoresManager } from '../../../../common';
import { useDevices } from '../../../devices/composables/composables';
import { channelsPropertiesStoreKey } from '../../../devices/store/keys';
import { useSpaces } from '../../../spaces/composables';
import { SCENE_CATEGORY_ICONS, SceneCategory } from '../../scenes.constants';
import { scenesActionsStoreKey } from '../../store/keys';
import type { ISceneAction } from '../../store/scenes.actions.store.types';

import type { ISceneDetailProps } from './scene-detail.types';

defineOptions({
	name: 'SceneDetail',
});

const props = defineProps<ISceneDetailProps>();

const { t } = useI18n();

const storesManager = injectStoresManager();
const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);
const actionsStore = storesManager.getStore(scenesActionsStoreKey);

const { spaces } = useSpaces();
const { devices } = useDevices();

// Get actions from the actions store
const actions = computed(() => actionsStore.findForScene(props.scene.id));

const categoryIcon = computed<string>(() => {
	return SCENE_CATEGORY_ICONS[props.scene.category] || SCENE_CATEGORY_ICONS[SceneCategory.GENERIC];
});

const spaceName = computed<string>(() => {
	if (!props.scene.primarySpaceId) {
		return t('scenes.fields.wholeHome');
	}
	const space = spaces.value.find((s) => s.id === props.scene.primarySpaceId);
	return space?.name || t('scenes.fields.wholeHome');
});

const getConfigValue = (action: ISceneAction, key: string): string => {
	return (action.configuration?.[key] as string) ?? '';
};

const getDeviceName = (deviceId: string): string => {
	if (!deviceId) return '-';
	const device = devices.value.find((d) => d.id === deviceId);
	return device?.name || deviceId;
};

const getPropertyName = (propertyId: string): string => {
	if (!propertyId) return '-';
	const property = propertiesStore.findById(propertyId);
	return property?.name || property?.identifier || propertyId;
};

const formatValue = (value: unknown): string => {
	if (value === undefined || value === null || value === '') return '-';
	if (typeof value === 'boolean') {
		return value ? 'ON' : 'OFF';
	}
	return String(value);
};

const formatDate = (date: Date): string => {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(date);
};
</script>

<style scoped>
.text-success {
	color: var(--el-color-success);
}

.text-danger {
	color: var(--el-color-danger);
}
</style>
