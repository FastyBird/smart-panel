<template>
	<virtual-wizard-card
		icon="mdi:devices"
		featured
		:title="title || t('devicesVirtualPlugin.wizard.layout.unnamed')"
		:subtitle="subtitle"
		data-test-id="virtual-wizard-summary"
	>
		<dl class="m-0 flex flex-col gap-5">
			<div
				v-for="item in items"
				:key="item.label"
				class="min-w-0"
			>
				<dt class="mb-1">
					<el-text size="small">
						{{ item.label }}
					</el-text>
				</dt>
				<dd class="m-0 whitespace-pre-line break-words">{{ item.value || '—' }}</dd>
			</div>
		</dl>
		<slot />
	</virtual-wizard-card>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElText } from 'element-plus';

import VirtualWizardCard from './virtual-wizard-card.vue';

defineProps<{ title?: string; subtitle?: string; items: { label: string; value: string | number | null | undefined }[] }>();
const { t } = useI18n();
</script>
