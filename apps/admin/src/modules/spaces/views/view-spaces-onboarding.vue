<template>
	<component
		:is="element?.components?.spaceWizard"
		v-if="element?.components?.spaceWizard"
	/>

	<entity-not-found
		v-else
		icon="mdi:wizard-hat"
		:message="t('spacesModule.texts.noWizardForSpaceType', { type })"
		:button-label="t('spacesModule.buttons.back.title')"
		@back="router.push({ name: RouteNames.SPACES })"
	/>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { EntityNotFound } from '../../../common';
import { useSpacesPlugins } from '../composables';
import { RouteNames } from '../spaces.constants';

const props = defineProps<{
	type: string;
}>();

const { t } = useI18n();
const router = useRouter();
const { getByPluginType } = useSpacesPlugins();

const plugin = computed(() => getByPluginType(props.type));
const element = computed(() => plugin.value?.elements.find((el) => !!el.components?.spaceWizard));
</script>
