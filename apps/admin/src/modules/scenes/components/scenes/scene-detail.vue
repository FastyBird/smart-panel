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
						:plural="scene.actions.length"
					>
						<template #count>
							<strong>{{ scene.actions.length }}</strong>
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
		v-if="scene.actions.length > 0"
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
					{{ scene.actions.length }}
				</el-tag>
			</div>
		</template>

		<el-table
			:data="scene.actions"
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
					{{ getDeviceName(scope.row.deviceId) }}
				</template>
			</el-table-column>
			<el-table-column
				:label="t('scenes.form.property')"
				prop="propertyId"
			>
				<template #default="scope">
					{{ getPropertyName(scope.row.propertyId) }}
				</template>
			</el-table-column>
			<el-table-column
				:label="t('scenes.form.value')"
				prop="value"
				:width="120"
			>
				<template #default="scope">
					<el-tag size="small">
						{{ formatValue(scope.row.value) }}
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

import type { ISceneDetailProps } from './scene-detail.types';

defineOptions({
	name: 'SceneDetail',
});

const props = defineProps<ISceneDetailProps>();

const { t } = useI18n();

const storesManager = injectStoresManager();
const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

const { spaces } = useSpaces();
const { devices } = useDevices();

const categoryIcon = computed<string>(() => {
	return SCENE_CATEGORY_ICONS[props.scene.category] || SCENE_CATEGORY_ICONS[SceneCategory.GENERIC];
});

const spaceName = computed<string>(() => {
	const space = spaces.value.find((s) => s.id === props.scene.primarySpaceId);
	return space?.name || t('scenes.fields.unknownSpace');
});

const getDeviceName = (deviceId: string): string => {
	const device = devices.value.find((d) => d.id === deviceId);
	return device?.name || deviceId;
};

const getPropertyName = (propertyId: string): string => {
	const property = propertiesStore.findById(propertyId);
	return property?.name || property?.identifier || propertyId;
};

const formatValue = (value: string | number | boolean): string => {
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
