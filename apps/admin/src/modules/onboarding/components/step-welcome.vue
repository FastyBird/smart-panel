<template>
	<div class="flex flex-col items-center text-center py-8 px-4">
		<el-icon
			:size="80"
			class="mb-6 text-primary"
		>
			<icon icon="mdi:home-automation" />
		</el-icon>

		<h2 class="text-2xl font-bold mb-4">
			{{ t('onboardingModule.welcome.title') }}
		</h2>

		<p class="text-base text-gray-500 mb-8 max-w-md">
			{{ t('onboardingModule.welcome.description') }}
		</p>

		<div class="flex flex-col gap-3 max-w-sm w-full">
			<div class="flex items-center gap-3 text-left p-3 rounded-lg bg-gray-50">
				<el-icon
					:size="24"
					class="text-primary shrink-0"
				>
					<icon icon="mdi:account-plus" />
				</el-icon>
				<div>
					<div class="font-medium">{{ t('onboardingModule.welcome.steps.account') }}</div>
					<div class="text-sm text-gray-400">{{ t('onboardingModule.welcome.steps.accountDescription') }}</div>
				</div>
			</div>

			<div class="flex items-center gap-3 text-left p-3 rounded-lg bg-gray-50">
				<el-icon
					:size="24"
					class="text-primary shrink-0"
				>
					<icon icon="mdi:map-marker" />
				</el-icon>
				<div>
					<div class="font-medium">{{ t('onboardingModule.welcome.steps.location') }}</div>
					<div class="text-sm text-gray-400">{{ t('onboardingModule.welcome.steps.locationDescription') }}</div>
				</div>
			</div>

			<div class="flex items-center gap-3 text-left p-3 rounded-lg bg-gray-50">
				<el-icon
					:size="24"
					class="text-primary shrink-0"
				>
					<icon icon="mdi:floor-plan" />
				</el-icon>
				<div>
					<div class="font-medium">{{ t('onboardingModule.welcome.steps.spaces') }}</div>
					<div class="text-sm text-gray-400">{{ t('onboardingModule.welcome.steps.spacesDescription') }}</div>
				</div>
			</div>

			<div class="flex items-center gap-3 text-left p-3 rounded-lg bg-gray-50">
				<el-icon
					:size="24"
					class="text-primary shrink-0"
				>
					<icon icon="mdi:puzzle" />
				</el-icon>
				<div>
					<div class="font-medium">{{ t('onboardingModule.welcome.steps.integrations') }}</div>
					<div class="text-sm text-gray-400">{{ t('onboardingModule.welcome.steps.integrationsDescription') }}</div>
				</div>
			</div>

			<div class="flex items-center gap-3 text-left p-3 rounded-lg bg-gray-50">
				<el-icon
					:size="24"
					class="text-primary shrink-0"
				>
					<icon icon="mdi:check-circle" />
				</el-icon>
				<div>
					<div class="font-medium">{{ t('onboardingModule.welcome.steps.finish') }}</div>
					<div class="text-sm text-gray-400">{{ t('onboardingModule.welcome.steps.finishDescription') }}</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { ElIcon } from 'element-plus';
import { useI18n } from 'vue-i18n';

defineOptions({
	name: 'StepWelcome',
});

const { t } = useI18n();
</script>
