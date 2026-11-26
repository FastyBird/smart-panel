<template>
	<view-header
		:title="t('buddyModule.wizard.title')"
		:subtitle="t('buddyModule.subHeadings.setup')"
		:on-back="onCancel"
		left="close"
		icon="mdi:magic-staff"
	/>

	<!-- Template 9: stepper card, centred step card and the sticky footer, scrolling as one page. The phone page scrolls
	     in the main area, so there the column only fills it; the footer sits at the bottom either way -->
	<div
		:class="['flex flex-col', isPhone ? 'min-h-full' : 'flex-1 min-h-0 overflow-y-auto']"
		data-test-id="buddy-setup-scroll"
	>
		<div class="page-pad pb-0! flex-1 box-border flex flex-col">
			<buddy-setup-wizard
				@completed="onCompleted"
				@cancel="onCancel"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { useRouter } from 'vue-router';

import { ViewHeader, useSizeClass } from '../../../common';
import { RouteNames } from '../buddy.constants';
import BuddySetupWizard from '../components/buddy-setup-wizard.vue';

defineOptions({
	name: 'ViewBuddySetup',
});

const { t } = useI18n();
const router = useRouter();

useMeta({
	title: t('buddyModule.meta.setup.title'),
});

const { isPhone } = useSizeClass();

// Back to the chat, which reads the providers again: a finished setup opens straight into a conversation
const onCompleted = (): void => {
	void router.push({ name: RouteNames.BUDDY });
};

const onCancel = (): void => {
	void router.push({ name: RouteNames.BUDDY });
};
</script>
