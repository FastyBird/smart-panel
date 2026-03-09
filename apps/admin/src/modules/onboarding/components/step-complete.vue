<template>
	<div class="flex flex-col items-center text-center py-8 px-4">
		<el-icon
			:size="80"
			class="mb-6 text-green-500"
		>
			<icon icon="mdi:check-circle-outline" />
		</el-icon>

		<h2 class="text-2xl font-bold mb-4">
			{{ t('onboardingModule.complete.title') }}
		</h2>

		<p class="text-base text-gray-500 mb-8 max-w-md">
			{{ t('onboardingModule.complete.description') }}
		</p>

		<div class="flex flex-col gap-3 max-w-sm w-full">
			<div class="flex items-center gap-3 p-3 rounded-lg bg-green-50">
				<el-icon
					:size="20"
					class="text-green-500 shrink-0"
				>
					<icon icon="mdi:check" />
				</el-icon>
				<span>{{ t('onboardingModule.complete.summary.accountCreated') }}</span>
			</div>

			<div
				v-if="locationConfigured"
				class="flex items-center gap-3 p-3 rounded-lg bg-green-50"
			>
				<el-icon
					:size="20"
					class="text-green-500 shrink-0"
				>
					<icon icon="mdi:check" />
				</el-icon>
				<span>{{ t('onboardingModule.complete.summary.locationConfigured') }}</span>
			</div>

			<div
				v-else
				class="flex items-center gap-3 p-3 rounded-lg bg-gray-50"
			>
				<el-icon
					:size="20"
					class="text-gray-400 shrink-0"
				>
					<icon icon="mdi:minus" />
				</el-icon>
				<span class="text-gray-400">{{ t('onboardingModule.complete.summary.locationSkipped') }}</span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { ElIcon } from 'element-plus';
import { useI18n } from 'vue-i18n';

defineOptions({
	name: 'StepComplete',
});

defineProps<{
	locationConfigured: boolean;
}>();

const { t } = useI18n();
</script>
