<template>
	<el-card shadow="never" class="mb-2" header-class="py-2! px-4!" body-class="py-2! px-4!">
		<template #header>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<span class="font-semibold">{{ entity.entityId }}</span>
					<el-tag
						:type="statusType"
						size="small"
					>
						{{ entity.status }}
					</el-tag>
				</div>
				<div class="flex items-center gap-2 text-sm text-gray-500">
					<span>{{ entity.domain }}</span>
					<span v-if="entity.deviceClass">•</span>
					<span v-if="entity.deviceClass">{{ entity.deviceClass }}</span>
				</div>
			</div>
		</template>

		<div v-if="entity.suggestedChannel" class="mb-3">
			<div class="flex items-center gap-2 mb-2">
				<span class="font-medium">{{ t('devicesHomeAssistantPlugin.fields.mapping.suggestedChannel.title') }}:</span>
				<span>{{ entity.suggestedChannel.name }}</span>
				<el-tag
					:type="confidenceType"
					size="small"
				>
					{{ entity.suggestedChannel.confidence }}
				</el-tag>
			</div>
			<div class="text-sm text-gray-600">
				{{ t(`devicesModule.categories.channels.${entity.suggestedChannel.category}`) }}
			</div>
		</div>

		<div v-if="entity.suggestedProperties.length > 0" class="mb-3">
			<div class="font-medium mb-2">{{ t('devicesHomeAssistantPlugin.fields.mapping.properties') }}:</div>
			<div class="grid grid-cols-2 gap-2 text-sm">
				<div
					v-for="property in entity.suggestedProperties"
					:key="`${property.category}-${property.haAttribute}`"
					class="flex items-center gap-2"
				>
					<span class="text-gray-600">{{ property.name }}:</span>
					<el-tag
						v-if="property.isVirtual"
						size="small"
						:type="getVirtualTagType(property.virtualType)"
						effect="plain"
					>
						{{ getVirtualLabel(property.virtualType) }}
					</el-tag>
					<el-tag
						v-else-if="property.currentValue !== null && property.currentValue !== undefined"
						size="small"
						type="info"
					>
						{{ property.currentValue }}
					</el-tag>
					<span v-else class="text-gray-400">—</span>
				</div>
			</div>
		</div>

		<div v-if="entity.unmappedAttributes.length > 0" class="text-sm text-gray-500">
			<span class="font-medium">{{ t('devicesHomeAssistantPlugin.fields.mapping.unmappedAttributes') }}:</span>
			{{ entity.unmappedAttributes.join(', ') }}
		</div>

		<div v-if="entity.missingRequiredProperties.length > 0" class="mt-2">
			<el-alert
				type="warning"
				:title="t('devicesHomeAssistantPlugin.fields.mapping.missingRequiredProperties')"
				:closable="false"
				show-icon
				:description="entity.missingRequiredProperties.map((p) => t(`devicesModule.categories.channelsProperties.${p}`)).join(', ')"
			/>
		</div>

		<div v-if="entity.status === 'incompatible' && entity.incompatibleReason" class="mt-2">
			<el-alert
				type="info"
				:title="t('devicesHomeAssistantPlugin.fields.mapping.incompatibleChannel')"
				:closable="false"
				show-icon
				:description="entity.incompatibleReason"
			/>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElCard, ElTag } from 'element-plus';

import type { IEntityMappingPreview } from '../../schemas/mapping-preview.types';

interface IEntityMappingCardProps {
	entity: IEntityMappingPreview;
}

const props = defineProps<IEntityMappingCardProps>();

const { t } = useI18n();

const statusType = computed(() => {
	switch (props.entity.status) {
		case 'mapped':
			return 'success';
		case 'partial':
			return 'warning';
		case 'unmapped':
			return 'danger';
		case 'skipped':
			return 'info';
		case 'incompatible':
			return 'warning';
		default:
			return 'info';
	}
});

const confidenceType = computed(() => {
	if (!props.entity.suggestedChannel) {
		return 'info';
	}

	switch (props.entity.suggestedChannel.confidence) {
		case 'high':
			return 'success';
		case 'medium':
			return 'warning';
		case 'low':
			return 'danger';
		default:
			return 'info';
	}
});

/**
 * Get the tag type for virtual property indicators
 */
const getVirtualTagType = (virtualType: string | undefined | null): 'success' | 'warning' | 'info' => {
	switch (virtualType) {
		case 'static':
			return 'info';
		case 'derived':
			return 'success';
		case 'command':
			return 'warning';
		default:
			return 'info';
	}
};

/**
 * Get the label for virtual property indicators
 */
const getVirtualLabel = (virtualType: string | undefined | null): string => {
	switch (virtualType) {
		case 'static':
			return t('devicesHomeAssistantPlugin.fields.mapping.virtualTypes.static');
		case 'derived':
			return t('devicesHomeAssistantPlugin.fields.mapping.virtualTypes.derived');
		case 'command':
			return t('devicesHomeAssistantPlugin.fields.mapping.virtualTypes.command');
		default:
			return t('devicesHomeAssistantPlugin.fields.mapping.virtualTypes.virtual');
	}
};
</script>
