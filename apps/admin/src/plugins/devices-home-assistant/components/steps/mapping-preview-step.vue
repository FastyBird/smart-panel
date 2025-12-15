<template>
	<div v-if="isPreviewLoading" class="flex justify-center items-center py-8">
		<el-icon class="is-loading" :size="32">
			<icon icon="mdi:loading" />
		</el-icon>
		<span class="ml-2">{{ t('devicesHomeAssistantPlugin.messages.mapping.previewLoading') }}</span>
	</div>

	<el-alert
		v-else-if="previewError"
		type="error"
		:title="t('devicesHomeAssistantPlugin.messages.mapping.previewError')"
		:description="previewError.message"
		:closable="false"
		show-icon
	/>

	<div v-else-if="preview" class="space-y-4">
		<!-- Summary -->
		<mapping-summary :preview="preview" />

		<!-- Warnings -->
		<mapping-warnings
			v-if="preview.warnings.length > 0"
			:warnings="preview.warnings"
		/>

		<!-- Entity Mappings -->
		<div>
			<h3 class="text-lg font-semibold mb-3">
				{{ t('devicesHomeAssistantPlugin.headings.mapping.entityMappings') }}
			</h3>
			<div class="space-y-2">
				<entity-mapping-card
					v-for="entity in preview.entities"
					:key="entity.entityId"
					:entity="entity"
				/>
			</div>
		</div>

		<!-- Ready to Adopt Status -->
		<el-alert
			:type="preview.readyToAdopt ? 'success' : 'warning'"
			:title="preview.readyToAdopt ? t('devicesHomeAssistantPlugin.messages.mapping.readyToAdopt') : t('devicesHomeAssistantPlugin.messages.mapping.notReadyToAdopt')"
			:closable="false"
			show-icon
		/>
	</div>

	<div v-else class="text-center py-8 text-gray-500">
		<el-icon :size="48" class="mb-4">
			<icon icon="mdi:information-outline" />
		</el-icon>
		<p>{{ t('devicesHomeAssistantPlugin.messages.mapping.noPreview') }}</p>
		<p class="text-sm mt-2">{{ t('devicesHomeAssistantPlugin.messages.mapping.selectDeviceFirst') }}</p>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElAlert, ElIcon } from 'element-plus';
import { Icon } from '@iconify/vue';

import type { IMappingPreviewResponse } from '../../schemas/mapping-preview.types';
import EntityMappingCard from '../mapping-preview/entity-mapping-card.vue';
import MappingSummary from '../mapping-preview/mapping-summary.vue';
import MappingWarnings from '../mapping-preview/mapping-warnings.vue';

interface IMappingPreviewStepProps {
	preview: IMappingPreviewResponse | null;
	isPreviewLoading: boolean;
	previewError: Error | null;
}

defineProps<IMappingPreviewStepProps>();

const { t } = useI18n();
</script>
