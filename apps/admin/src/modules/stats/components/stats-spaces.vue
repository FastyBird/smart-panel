<template>
	<stat-tile
		icon="mdi:home-group"
		:label="t('statsModule.headings.spaces')"
		:value="firstLoadFinished ? String(totalCount) : spacesFailed ? '—' : ''"
		:loading="props.loading || (!firstLoadFinished && !spacesFailed)"
	/>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
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

const { spaces, fetchSpaces, firstLoadFinished } = useSpaces();

// The spaces could not be loaded: the tile says there is no figure instead of loading for ever
const spacesFailed = ref<boolean>(false);

const nonDraftSpaces = computed(() => spaces.value.filter((space) => !space.draft));

const totalCount = computed<number>(() => nonDraftSpaces.value.length);

onBeforeMount(() => {
	fetchSpaces().catch((): void => {
		spacesFailed.value = true;
	});
});
</script>
