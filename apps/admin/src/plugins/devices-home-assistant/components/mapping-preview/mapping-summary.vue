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
		</dl>

		<!-- Validation Summary -->
		<div
			v-if="preview.validation"
			class="mt-4 pt-4 border-t"
		>
			<div class="flex items-center gap-2 mb-2">
				<span class="font-medium">{{ t('devicesHomeAssistantPlugin.fields.mapping.validation.valid') }}:</span>
				<el-tag
					:type="preview.validation.isValid ? 'success' : 'danger'"
					size="small"
				>
					{{ preview.validation.isValid ? 'Yes' : 'No' }}
				</el-tag>
			</div>

			<!-- Virtual properties auto-filled -->
			<div
				v-if="virtualPropertiesCount > 0"
				class="flex items-center gap-2 text-sm text-gray-600"
			>
				<el-icon class="text-primary"><InfoFilled /></el-icon>
				<span>{{ virtualPropertiesCount }} {{ t('devicesHomeAssistantPlugin.fields.mapping.validation.autoFilled') }}</span>
			</div>

			<!-- Missing channels warning -->
			<div
				v-if="preview.validation.missingChannelsCount > 0"
				class="mt-2"
			>
				<el-alert
					type="warning"
					:closable="false"
					show-icon
				>
					<template #title>
						{{ t('devicesHomeAssistantPlugin.fields.mapping.validation.missingChannels') }}:
						{{ preview.validation.missingChannels.join(', ') }}
					</template>
				</el-alert>
			</div>

			<!-- Unknown channels error -->
			<div
				v-if="preview.validation.unknownChannels?.length > 0"
				class="mt-2"
			>
				<el-alert
					type="error"
					:closable="false"
					show-icon
				>
					<template #title>
						{{ t('devicesHomeAssistantPlugin.fields.mapping.validation.unknownChannels') }}:
						{{ preview.validation.unknownChannels.join(', ') }}
					</template>
				</el-alert>
			</div>

			<!-- Duplicate channels error -->
			<div
				v-if="preview.validation.duplicateChannels?.length > 0"
				class="mt-2"
			>
				<el-alert
					type="error"
					:closable="false"
					show-icon
				>
					<template #title>
						{{ t('devicesHomeAssistantPlugin.fields.mapping.validation.duplicateChannels') }}:
						{{ preview.validation.duplicateChannels.join(', ') }}
					</template>
				</el-alert>
			</div>

			<!-- Constraint violations error -->
			<div
				v-if="preview.validation.constraintViolations?.length > 0"
				class="mt-2"
			>
				<el-alert
					type="error"
					:closable="false"
					show-icon
				>
					<template #title>
						{{ t('devicesHomeAssistantPlugin.fields.mapping.validation.constraintViolations') }}
					</template>
					<template #default>
						<ul class="list-disc pl-4 mt-1">
							<li
								v-for="(violation, index) in preview.validation.constraintViolations"
								:key="index"
							>
								{{ violation }}
							</li>
						</ul>
					</template>
				</el-alert>
			</div>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { InfoFilled } from '@element-plus/icons-vue';
import { ElAlert, ElCard, ElIcon, ElTag } from 'element-plus';

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

const virtualPropertiesCount = computed(() => {
	return props.preview.validation?.fillableWithVirtualCount ?? 0;
});
</script>
