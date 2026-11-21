<template>
	<define-search>
		<el-input
			v-model="search"
			:placeholder="t('devicesModule.wizard.selection.searchPlaceholder')"
			:aria-label="t('devicesModule.wizard.selection.search')"
			:disabled="loading || error"
			clearable
			class="w-full"
			data-test-id="wizard-selection-search"
		>
			<template #prefix><icon icon="mdi:magnify" /></template>
		</el-input>
	</define-search>
	<app-breadcrumbs :items="breadcrumbs" />
	<view-header
		:title="title"
		icon="mdi:wizard-hat"
		class="wizard-selection-header"
	>
		<template
			v-if="isMDDevice"
			#actions
		>
			<div class="w-80 max-w-full"><reuse-search /></div>
		</template>
	</view-header>
	<header
		v-if="!isMDDevice"
		class="flex flex-col gap-3 mx-4 mt-3"
	>
		<h1 class="text-lg font-semibold m-0">{{ title }}</h1>
		<reuse-search />
	</header>
	<el-scrollbar
		class="flex-1 min-h-0"
		data-test-id="wizard-selection"
	>
		<div class="p-4 sm:p-6 space-y-7">
			<p class="m-0 text-[var(--el-text-color-regular)]">{{ description }}</p>
			<el-alert
				v-if="error"
				:title="t('devicesModule.wizard.loadFailed')"
				type="error"
				:closable="false"
				show-icon
			>
				<el-button @click="emit('retry')">{{ t('devicesModule.wizard.retry') }}</el-button>
			</el-alert>
			<div
				v-else-if="loading"
				v-loading="true"
				class="h-30"
			/>
			<template v-else>
				<empty-state
					v-if="!filteredSections.length"
					:icon="search.trim() ? 'mdi:magnify' : 'mdi:devices'"
					:description="t(search.trim() ? 'devicesModule.wizard.selection.noResults' : 'devicesModule.wizard.noPlugins')"
				>
					<el-button
						v-if="search.trim()"
						@click="search = ''"
					>
						{{ t('devicesModule.wizard.selection.clearSearch') }}
					</el-button>
				</empty-state>
				<section
					v-for="section in filteredSections"
					:key="section.id"
					:aria-labelledby="`wizard-section-${section.id}`"
					:data-test-id="`wizard-section-${section.id}`"
				>
					<h2
						:id="`wizard-section-${section.id}`"
						class="text-base font-semibold m-0"
					>
						{{ section.label }}
					</h2>
					<p
						v-if="section.description"
						class="text-sm text-[var(--el-text-color-regular)] mt-1 mb-3"
					>
						{{ section.description }}
					</p>
					<div class="wizard-selection-grid mt-3">
						<el-card
							v-for="choice in section.choices"
							:key="choice.id"
							shadow="never"
							class="wizard-selection-choice cursor-pointer h-full"
							body-class="p-4! h-full box-border"
							role="button"
							tabindex="0"
							:aria-label="choice.label"
							:data-test-id="`wizard-choice-${choice.id}`"
							@click="emit('select', choice)"
							@keydown.enter.self.prevent="emit('select', choice)"
							@keydown.space.self.prevent="emit('select', choice)"
						>
							<div class="flex items-start gap-3">
								<div
									class="wizard-choice-icon w-9 h-9 shrink-0 rounded flex items-center justify-center bg-[var(--el-fill-color-light)] text-[var(--el-text-color-regular)]"
								>
									<icon
										:icon="choice.icon"
										class="text-xl"
										aria-hidden="true"
									/>
								</div>
								<div class="flex-1 min-w-0">
									<strong class="text-sm">{{ choice.label }}</strong>
									<p class="text-sm text-[var(--el-text-color-regular)] mt-1 mb-0 leading-5">{{ choice.description }}</p>
								</div>
								<icon
									icon="mdi:chevron-right"
									class="shrink-0 mt-2 text-[var(--el-text-color-secondary)]"
									aria-hidden="true"
								/>
							</div>
						</el-card>
					</div>
				</section>
			</template>
			<p class="text-sm text-[var(--el-text-color-regular)] m-0">
				{{ t('devicesModule.wizard.selection.manualHint') }}
				<el-link
					type="primary"
					class="ml-1 align-baseline!"
					underline="always"
					data-test-id="wizard-manual-configuration"
					@click="emit('manual')"
				>
					{{ t('devicesModule.buttons.manual.title') }}
				</el-link>
			</p>
		</div>
	</el-scrollbar>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { useRouter } from 'vue-router';

import { ElAlert, ElButton, ElCard, ElInput, ElLink, ElScrollbar, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';
import { createReusableTemplate } from '@vueuse/core';

import { AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../../common';
import EmptyState from '../../../../common/components/empty-state.vue';
import { RouteNames } from '../../devices.constants';

import type { IDeviceWizardSelectionChoice, IDeviceWizardSelectionSection } from './device-wizard-selection.types';

const props = defineProps<{ title: string; description: string; sections: IDeviceWizardSelectionSection[]; loading: boolean; error: boolean }>();
const emit = defineEmits<{ select: [choice: IDeviceWizardSelectionChoice]; retry: []; manual: [] }>();
const { t } = useI18n();
const router = useRouter();
const { isMDDevice } = useBreakpoints();
const [DefineSearch, ReuseSearch] = createReusableTemplate();
const search = ref('');
const { meta } = useMeta({ title: props.title });
watch(
	() => props.title,
	(title) => {
		meta.title = title;
	}
);
const breadcrumbs = computed(() => [{ label: t('devicesModule.breadcrumbs.devices.list'), route: router.resolve({ name: RouteNames.DEVICES }) }]);
const normalize = (text: string): string =>
	text
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLocaleLowerCase();
const filteredSections = computed(() => {
	const query = normalize(search.value.trim());
	return props.sections
		.map((section) => ({
			...section,
			choices: section.choices.filter(
				(choice) => !query || normalize([choice.label, choice.description, ...(choice.keywords ?? [])].join(' ')).includes(query)
			),
		}))
		.filter((section) => section.choices.length);
});
</script>
<style scoped>
.wizard-selection-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
	gap: 12px;
}
.wizard-selection-choice:hover,
.wizard-selection-choice:focus-visible {
	border-color: var(--el-color-primary);
}
.wizard-selection-choice:hover .wizard-choice-icon,
.wizard-selection-choice:focus-visible .wizard-choice-icon {
	color: var(--el-color-primary);
}
.wizard-selection-choice:focus-visible {
	outline: 2px solid var(--el-color-primary-light-7);
	outline-offset: 2px;
}
.wizard-selection-header :deep(.el-page-header__header) {
	flex-wrap: wrap;
	gap: 12px;
}
</style>
