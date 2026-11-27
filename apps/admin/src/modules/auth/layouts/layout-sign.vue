<template>
	<!-- Template 10, standalone: sign in and sign up outside the shell -->
	<standalone-layout
		:title="heading"
		:subtitle="subtitle"
		:logo-to="{ name: RouteNames.SIGN_IN }"
		:logo-label="t('authModule.buttons.goToSignIn.title')"
	>
		<router-view />
	</standalone-layout>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import { StandaloneLayout } from '../../../common';
import { RouteNames } from '../auth.constants';

defineOptions({
	name: 'LayoutSign',
});

const { t } = useI18n();

const route = useRoute();

const isSignUp = computed<boolean>((): boolean => route.name === RouteNames.SIGN_UP);

const heading = computed<string>((): string => (isSignUp.value ? t('authModule.headings.signUp') : t('authModule.headings.signIn')));

const subtitle = computed<string>((): string => (isSignUp.value ? t('authModule.subHeadings.signUp') : t('authModule.subHeadings.signIn')));
</script>
