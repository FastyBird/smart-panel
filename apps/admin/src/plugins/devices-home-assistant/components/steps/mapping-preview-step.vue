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

		<!-- Debug Button -->
		<div class="flex justify-end pt-2">
			<el-button
				type="info"
				size="small"
				plain
				@click="showDebugModal = true"
			>
				<template #icon>
					<icon icon="mdi:bug-outline" />
				</template>
				{{ t('devicesHomeAssistantPlugin.buttons.debug') }}
			</el-button>
		</div>

		<!-- Debug Modal -->
		<el-dialog
			v-model="showDebugModal"
			:title="t('devicesHomeAssistantPlugin.headings.mapping.debugData')"
			width="80%"
			top="5vh"
		>
			<div class="mb-4">
				<el-alert
					type="info"
					:title="t('devicesHomeAssistantPlugin.messages.mapping.debugDescription')"
					:closable="false"
					show-icon
				/>
			</div>
			<el-input
				v-model="debugDataJson"
				type="textarea"
				:rows="20"
				readonly
				class="font-mono text-sm"
			/>
			<template #footer>
				<div class="flex justify-between">
					<el-button @click="showDebugModal = false">
						{{ t('devicesHomeAssistantPlugin.buttons.close') }}
					</el-button>
					<el-button
						type="primary"
						@click="copyDebugData"
					>
						<template #icon>
							<icon icon="mdi:content-copy" />
						</template>
						{{ t('devicesHomeAssistantPlugin.buttons.copyToClipboard') }}
					</el-button>
				</div>
			</template>
		</el-dialog>
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
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElDialog, ElIcon, ElInput } from 'element-plus';
import { Icon } from '@iconify/vue';

import { useFlashMessage } from '../../../../common';
import type { IMappingPreviewResponse } from '../../schemas/mapping-preview.types';
import EntityMappingCard from '../mapping-preview/entity-mapping-card.vue';
import MappingSummary from '../mapping-preview/mapping-summary.vue';
import MappingWarnings from '../mapping-preview/mapping-warnings.vue';

interface IMappingPreviewStepProps {
	preview: IMappingPreviewResponse | null;
	isPreviewLoading: boolean;
	previewError: Error | null;
}

const props = defineProps<IMappingPreviewStepProps>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const showDebugModal = ref(false);

const debugDataJson = computed(() => {
	if (!props.preview) return '';

	const debugData = {
		_notice: 'This data can be shared with developers to help diagnose mapping issues',
		_timestamp: new Date().toISOString(),
		haDevice: props.preview.haDevice,
		suggestedDevice: props.preview.suggestedDevice,
		entities: props.preview.entities.map((entity) => ({
			entityId: entity.entityId,
			domain: entity.domain,
			deviceClass: entity.deviceClass,
			status: entity.status,
			incompatibleReason: entity.incompatibleReason ?? null,
			currentState: entity.currentState,
			attributes: entity.attributes,
			suggestedChannel: entity.suggestedChannel,
			suggestedProperties: entity.suggestedProperties,
			unmappedAttributes: entity.unmappedAttributes,
			missingRequiredProperties: entity.missingRequiredProperties,
		})),
		warnings: props.preview.warnings,
		validation: props.preview.validation,
		readyToAdopt: props.preview.readyToAdopt,
	};

	return JSON.stringify(debugData, null, 2);
});

const copyDebugData = async () => {
	try {
		await navigator.clipboard.writeText(debugDataJson.value);
		flashMessage.success(t('devicesHomeAssistantPlugin.messages.mapping.debugCopied'));
	} catch {
		flashMessage.error(t('devicesHomeAssistantPlugin.messages.mapping.debugCopyFailed'));
	}
};
</script>
