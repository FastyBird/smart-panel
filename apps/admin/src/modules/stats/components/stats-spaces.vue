<template>
	<stat-tile
		icon="mdi:home-group"
		:label="t('statsModule.headings.spaces')"
		:value="String(totalCount)"
		:loading="props.loading"
	/>
</template>

<script setup lang="ts">
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';

import { useSpaces } from '../../spaces';

import StatTile from './stat-tile.vue';
import type { IStatsSpacesProps } from './stats-spaces.types';

defineOptions({
	name: 'StatsSpaces',
});

const props = withDefaults(defineProps<IStatsSpacesProps>(), {
	loading: false,
});

const { t } = useI18n();

const { spaces, fetchSpaces } = useSpaces();

const nonDraftSpaces = computed(() => spaces.value.filter((space) => !space.draft));

const totalCount = computed<number>(() => nonDraftSpaces.value.length);

onBeforeMount(() => {
	fetchSpaces();
});
</script>
