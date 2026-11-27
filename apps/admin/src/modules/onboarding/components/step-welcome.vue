<template>
	<div class="flex flex-col items-center gap-4 p-4 tp:p-5 text-center">
		<h2 class="m-0 text-section">
			{{ t('onboardingModule.welcome.title') }}
		</h2>

		<p class="m-0 max-w-md text-help">
			{{ t('onboardingModule.welcome.description') }}
		</p>

		<!-- What the steps ahead set up -->
		<ul class="flex flex-col gap-2 w-full max-w-sm m-0 p-0 list-none text-left">
			<li
				v-for="item in ITEMS"
				:key="item.id"
				class="flex items-center gap-3 p-3 rounded-lg bg-fill-light"
			>
				<icon
					:icon="item.icon"
					class="shrink-0 text-primary"
					width="24"
					height="24"
					aria-hidden="true"
				/>
				<div class="flex flex-col min-w-0">
					<span class="text-card-title">{{ t(`onboardingModule.welcome.steps.${item.id}`) }}</span>
					<span class="text-help">{{ t(`onboardingModule.welcome.steps.${item.id}Description`) }}</span>
				</div>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { Icon } from '@iconify/vue';

defineOptions({
	name: 'StepWelcome',
});

const { t } = useI18n();

const ITEMS: { id: string; icon: string }[] = [
	{ id: 'account', icon: 'mdi:account-plus' },
	{ id: 'location', icon: 'mdi:map-marker' },
	{ id: 'integrations', icon: 'mdi:puzzle' },
	{ id: 'spaces', icon: 'mdi:floor-plan' },
	{ id: 'finish', icon: 'mdi:check-circle' },
];
</script>
