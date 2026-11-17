<template>
	<virtual-wizard-card
		class="virtual-wizard-review-section"
		:flush="!padded"
		:icon="icon"
	>
		<template #header>
			<div class="flex items-center justify-between gap-3">
				<div class="flex flex-wrap items-center gap-2 min-w-0">
					<strong>{{ title }}</strong>
					<el-text
						v-if="description"
						size="small"
					>
						{{ description }}
					</el-text>
					<el-tag
						v-if="count !== undefined"
						size="small"
						type="info"
					>
						{{ count }}
					</el-tag>
				</div>
				<el-button
					v-if="editable !== false"
					size="small"
					class="shrink-0"
					:disabled="disabled"
					@click="emit('edit')"
				>
					{{ t('devicesVirtualPlugin.wizard.layout.edit') }}
				</el-button>
			</div>
		</template>
		<slot />
	</virtual-wizard-card>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElTag, ElText } from 'element-plus';

import VirtualWizardCard from './virtual-wizard-card.vue';

withDefaults(
	defineProps<{ title: string; description?: string; count?: number; disabled?: boolean; editable?: boolean; padded?: boolean; icon?: string }>(),
	{ description: undefined, count: undefined, icon: 'mdi:clipboard-text-outline' }
);
const emit = defineEmits<{ edit: [] }>();
const { t } = useI18n();
</script>
