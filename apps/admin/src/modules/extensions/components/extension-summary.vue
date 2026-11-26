<template>
	<!-- Template 3: the summary card at the top of the extension: what it is, its state, its details and links -->
	<el-card
		shadow="never"
		body-class="flex flex-col gap-4 p-4!"
		data-test-id="extension-summary"
	>
		<div class="flex flex-wrap items-center gap-4">
			<div
				class="flex items-center justify-center shrink-0 w-14 h-14 rounded-lg bg-primary-soft"
				aria-hidden="true"
			>
				<icon
					:icon="props.extension.kind === ExtensionKind.module ? 'mdi:package-variant' : 'mdi:toy-brick'"
					width="32"
					height="32"
					class="text-primary"
				/>
			</div>

			<div class="flex flex-col gap-1 min-w-0 flex-1">
				<div class="flex flex-wrap items-center gap-2">
					<span class="text-section">{{ props.extension.name }}</span>
					<status-tag
						:status="props.extension.enabled ? 'ok' : 'info'"
						:label="props.extension.enabled ? t('extensionsModule.labels.enabled') : t('extensionsModule.labels.disabled')"
						data-test-id="extension-summary-state"
					/>
				</div>
				<span class="text-secondary">{{ kindLabel }}</span>
			</div>
		</div>

		<p
			v-if="props.extension.description"
			class="text-body m-0"
		>
			{{ props.extension.description }}
		</p>

		<kv-grid
			:items="details"
			:cols="isPhone ? 2 : 3"
		/>

		<ul
			v-if="links.length > 0"
			:aria-label="t('extensionsModule.labels.links')"
			class="flex flex-wrap gap-2 m-0 p-0 list-none"
		>
			<li
				v-for="link in links"
				:key="link.id"
			>
				<a
					:href="link.href"
					class="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--el-border-radius-base)] border border-solid border-default text-regular no-underline hover:border-primary hover:text-primary"
					target="_blank"
					rel="noopener noreferrer"
				>
					<icon
						:icon="link.icon"
						aria-hidden="true"
					/>
					{{ link.label }}
				</a>
			</li>
		</ul>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard } from 'element-plus';

import { Icon } from '@iconify/vue';

import { KvGrid, type KvGridItem, StatusTag, useSizeClass } from '../../../common';
import { ExtensionKind } from '../extensions.constants';
import type { IExtension } from '../store/extensions.store.types';

defineOptions({
	name: 'ExtensionSummary',
});

const props = defineProps<{ extension: IExtension }>();

const { t } = useI18n();

const { isPhone } = useSizeClass();

const kindName = computed<string>(() =>
	props.extension.kind === ExtensionKind.module ? t('extensionsModule.labels.module') : t('extensionsModule.labels.plugin')
);

const sourceName = computed<string>(() => (props.extension.isCore ? t('extensionsModule.labels.core') : t('extensionsModule.labels.addon')));

// "Module · Core", "Plugin · Add-on"
const kindLabel = computed<string>(() => `${kindName.value} · ${sourceName.value}`);

const details = computed<KvGridItem[]>(() => [
	{ label: t('extensionsModule.labels.type'), value: props.extension.type, mono: true },
	{ label: t('extensionsModule.labels.kind'), value: kindName.value },
	{ label: t('extensionsModule.labels.source'), value: sourceName.value },
	{ label: t('extensionsModule.labels.version'), value: props.extension.version ?? '—', mono: !!props.extension.version },
	{ label: t('extensionsModule.labels.author'), value: props.extension.author ?? '—' },
]);

interface ILink {
	id: string;
	href: string;
	icon: string;
	label: string;
}

const links = computed<ILink[]>(() => {
	const items: ILink[] = [];
	const source = props.extension.links;

	if (source?.documentation) {
		items.push({
			id: 'documentation',
			href: source.documentation,
			icon: 'mdi:book-open-page-variant',
			label: t('extensionsModule.buttons.documentation'),
		});
	}

	if (source?.repository) {
		items.push({ id: 'repository', href: source.repository, icon: 'mdi:github', label: t('extensionsModule.buttons.repository') });
	}

	if (source?.bugsTracking) {
		items.push({ id: 'issues', href: source.bugsTracking, icon: 'mdi:bug', label: t('extensionsModule.buttons.issues') });
	}

	return items;
});
</script>
