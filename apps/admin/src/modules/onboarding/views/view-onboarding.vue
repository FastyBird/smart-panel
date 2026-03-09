<template>
	<div class="onboarding-view">
		<div class="onboarding-view__container">
			<h1>{{ t('onboardingModule.welcome.title') }}</h1>
			<p>{{ t('onboardingModule.welcome.description') }}</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<style scoped>
.onboarding-view {
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 100vh;
}

.onboarding-view__container {
	max-width: 600px;
	padding: 2rem;
	text-align: center;
}
</style>
