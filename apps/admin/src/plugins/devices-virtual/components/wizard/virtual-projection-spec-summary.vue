<template>
	<virtual-wizard-card
		:title="text('structureTitle')"
		:subtitle="category ? t(`devicesModule.categories.devices.${category}`) : undefined"
		icon="mdi:sitemap-outline"
		flush
	>
		<div
			v-if="!category"
			class="p-3"
		>
			<el-text>{{ t('devicesVirtualPlugin.wizard.mapping.noCategory') }}</el-text>
		</div>
		<template v-else>
			<div
				v-for="group in required"
				:key="group.specChannel"
				class="projection-structure__channel"
			>
				<div class="p-3">
					<el-text size="small">{{ t('devicesVirtualPlugin.wizard.mapping.channelRequired') }}</el-text>
					<strong class="block mt-1">{{ channelLabel(group.specChannel) }}</strong>
				</div>
				<virtual-wizard-descriptions :column="1">
					<el-descriptions-item
						v-if="group.slots.some((slot) => slot.propertyRequired)"
						:label="text('mustHave')"
					>
						<div class="flex flex-wrap gap-1">
							<el-tag
								v-for="slot in group.slots.filter((slot) => slot.propertyRequired)"
								:key="slot.key"
								type="primary"
								size="small"
							>
								{{ propertyLabel(slot.specProperty) }}
							</el-tag>
						</div>
					</el-descriptions-item>
					<el-descriptions-item
						v-if="group.slots.some((slot) => !slot.propertyRequired)"
						:label="text('canHave')"
					>
						<div class="flex flex-wrap gap-1">
							<el-tag
								v-for="slot in group.slots.filter((slot) => !slot.propertyRequired)"
								:key="slot.key"
								type="info"
								size="small"
							>
								{{ propertyLabel(slot.specProperty) }}
							</el-tag>
						</div>
					</el-descriptions-item>
				</virtual-wizard-descriptions>
			</div>
			<div
				v-if="optional.length"
				class="projection-structure__optional p-3"
			>
				<strong class="block mb-2">{{ text('optionalChannels') }}</strong>
				<div class="flex flex-wrap gap-1">
					<el-tag
						v-for="group in optional"
						:key="group.specChannel"
						type="info"
						size="small"
					>
						{{ channelLabel(group.specChannel) }}
					</el-tag>
				</div>
			</div>
		</template>
	</virtual-wizard-card>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElDescriptionsItem, ElTag, ElText } from 'element-plus';

import type { DevicesModuleDeviceCategory } from '../../../../openapi.constants';
import { projectionSlotGroups } from '../../utils/projection-specification';
import VirtualWizardCard from '../virtual-wizard-card.vue';
import VirtualWizardDescriptions from '../virtual-wizard-descriptions.vue';

const props = defineProps<{ category: DevicesModuleDeviceCategory | null }>();
const { t } = useI18n();
const text = (key: string, params = {}) => t(`devicesVirtualPlugin.wizard.projection.${key}`, params);
const groups = computed(() => projectionSlotGroups(props.category));
const required = computed(() => groups.value.filter((group) => group.required));
const optional = computed(() => groups.value.filter((group) => !group.required));
const channelLabel = (value: string) => t(`devicesModule.categories.channels.${value}`);
const propertyLabel = (value: string) => t(`devicesModule.categories.channelsProperties.${value}`);
</script>
<style scoped>
.projection-structure__channel :deep(.virtual-wizard-descriptions .el-descriptions__table) {
	border-top: 1px solid var(--el-border-color-lighter);
}
.projection-structure__channel + .projection-structure__channel,
.projection-structure__optional {
	border-top: 1px solid var(--el-border-color-lighter);
}
</style>
