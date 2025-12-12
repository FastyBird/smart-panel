<template>
	<el-card>
		<template #header>
			<div class="flex items-center justify-between">
				<span class="font-semibold">{{ t('devicesHomeAssistantPlugin.headings.mapping.summary') }}</span>
				<el-tag
					:type="preview.readyToAdopt ? 'success' : 'warning'"
					effect="dark"
				>
					{{ preview.readyToAdopt ? t('devicesHomeAssistantPlugin.messages.mapping.readyToAdopt') : t('devicesHomeAssistantPlugin.messages.mapping.notReadyToAdopt') }}
				</el-tag>
			</div>
		</template>

		<dl class="grid grid-cols-2 gap-x-4 gap-y-2">
			<dt class="font-medium">{{ t('devicesHomeAssistantPlugin.fields.mapping.totalEntities') }}:</dt>
			<dd class="m-0">{{ preview.entities.length }}</dd>

			<dt class="font-medium">{{ t('devicesHomeAssistantPlugin.fields.mapping.mapped') }}:</dt>
			<dd class="m-0">
				<el-tag type="success" size="small">
					{{ mappedCount }}
				</el-tag>
			</dd>

			<dt class="font-medium">{{ t('devicesHomeAssistantPlugin.fields.mapping.partial') }}:</dt>
			<dd class="m-0">
				<el-tag type="warning" size="small">
					{{ partialCount }}
				</el-tag>
			</dd>

			<dt class="font-medium">{{ t('devicesHomeAssistantPlugin.fields.mapping.unmapped') }}:</dt>
			<dd class="m-0">
				<el-tag type="danger" size="small">
					{{ unmappedCount }}
				</el-tag>
			</dd>

			<dt class="font-medium">{{ t('devicesHomeAssistantPlugin.fields.mapping.skipped') }}:</dt>
			<dd class="m-0">
				<el-tag type="info" size="small">
					{{ skippedCount }}
				</el-tag>
			</dd>

			<dt class="font-medium">{{ t('devicesHomeAssistantPlugin.fields.mapping.suggestedCategory') }}:</dt>
			<dd class="m-0">
				{{ t(`devicesModule.categories.devices.${preview.suggestedDevice.category}`) }}
				<el-tag
					:type="preview.suggestedDevice.confidence === 'high' ? 'success' : preview.suggestedDevice.confidence === 'medium' ? 'warning' : 'danger'"
					size="small"
					class="ml-2"
				>
					{{ preview.suggestedDevice.confidence }}
				</el-tag>
			</dd>
		</dl>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard, ElTag } from 'element-plus';

import type { IMappingPreviewResponse } from '../../schemas/mapping-preview.types';

interface IMappingSummaryProps {
	preview: IMappingPreviewResponse;
}

const props = defineProps<IMappingSummaryProps>();

const { t } = useI18n();

const mappedCount = computed(() => props.preview.entities.filter((e) => e.status === 'mapped').length);
const partialCount = computed(() => props.preview.entities.filter((e) => e.status === 'partial').length);
const unmappedCount = computed(() => props.preview.entities.filter((e) => e.status === 'unmapped').length);
const skippedCount = computed(() => props.preview.entities.filter((e) => e.status === 'skipped').length);
</script>
