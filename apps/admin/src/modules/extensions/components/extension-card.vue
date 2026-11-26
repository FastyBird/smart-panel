<template>
	<!-- Template 2: one catalogue card. Name and state on top, what it is below, its links and actions at the foot -->
	<article
		:aria-labelledby="titleId"
		:class="[
			'flex flex-col h-full box-border bg-surface border border-solid rounded-lg overflow-hidden',
			props.extension.enabled ? 'border-light' : 'border-light opacity-80',
		]"
		:data-extension="props.extension.type"
		data-test-id="extension-card"
	>
		<header class="flex items-start gap-3 px-4 pt-4">
			<span
				class="flex items-center justify-center shrink-0 w-10 h-10 rounded-lg bg-primary-soft"
				aria-hidden="true"
			>
				<icon
					:icon="extensionIcon"
					width="24"
					height="24"
					class="text-primary"
				/>
			</span>

			<div class="flex flex-col gap-1 flex-1 min-w-0">
				<h3
					:id="titleId"
					class="text-card-title m-0 truncate"
				>
					{{ props.extension.name }}
				</h3>
				<span class="text-caption truncate">{{ kindLabel }}</span>
			</div>

			<status-tag
				:status="props.extension.enabled ? 'ok' : 'info'"
				:label="props.extension.enabled ? t('extensionsModule.labels.enabled') : t('extensionsModule.labels.disabled')"
				class="shrink-0"
			/>
		</header>

		<div class="flex flex-col gap-3 flex-1 px-4 py-3">
			<p
				:class="['m-0 line-clamp-3', props.extension.description ? 'text-body' : 'text-help italic']"
				:title="props.extension.description || undefined"
			>
				{{ props.extension.description || t('extensionsModule.messages.noDescription') }}
			</p>

			<dl
				v-if="props.extension.version || props.extension.author"
				class="flex flex-wrap gap-x-4 gap-y-1 m-0 text-help"
			>
				<div
					v-if="props.extension.version"
					class="flex items-center gap-1"
				>
					<dt class="sr-only">{{ t('extensionsModule.labels.version') }}</dt>
					<icon
						icon="mdi:tag-outline"
						aria-hidden="true"
					/>
					<dd class="m-0 text-mono">{{ props.extension.version }}</dd>
				</div>
				<div
					v-if="props.extension.author"
					class="flex items-center gap-1 min-w-0"
				>
					<dt class="sr-only">{{ t('extensionsModule.labels.author') }}</dt>
					<icon
						icon="mdi:account-outline"
						aria-hidden="true"
					/>
					<dd class="m-0 truncate">{{ props.extension.author }}</dd>
				</div>
			</dl>

			<ul
				v-if="links.length > 0"
				class="flex flex-wrap gap-x-3 gap-y-1 m-0 p-0 list-none"
			>
				<li
					v-for="link in links"
					:key="link.id"
				>
					<a
						:href="link.href"
						class="inline-flex items-center gap-1 text-help text-primary no-underline hover:underline"
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
		</div>

		<footer class="flex items-center gap-2 px-4 py-3 border-t border-t-solid border-light">
			<el-tooltip
				:content="toggleDisabledReason"
				:disabled="props.extension.canToggleEnabled"
				placement="top"
			>
				<!-- The wrapper keeps the tooltip working while the switch is disabled -->
				<span class="inline-flex items-center gap-2">
					<el-switch
						:model-value="props.extension.enabled"
						:disabled="!props.extension.canToggleEnabled"
						:aria-label="t('extensionsModule.aria.enable', { name: props.extension.name })"
						data-test-id="extension-card-enabled"
						@update:model-value="(value: string | number | boolean) => emit('toggle-enabled', props.extension.type, value === true)"
					/>
					<span class="text-help">{{ t('extensionsModule.labels.enabled') }}</span>
				</span>
			</el-tooltip>

			<span class="flex-1" />

			<el-button
				plain
				data-test-id="extension-card-detail"
				@click="emit('detail', props.extension.type)"
			>
				{{ t('extensionsModule.buttons.detail.title') }}
			</el-button>

			<el-tooltip
				:content="t('extensionsModule.buttons.more.title')"
				placement="top"
			>
				<el-dropdown
					trigger="click"
					placement="bottom-end"
				>
					<el-button
						:aria-label="t('extensionsModule.aria.more', { name: props.extension.name })"
						text
						circle
						data-test-id="extension-card-more"
					>
						<template #icon>
							<icon icon="mdi:dots-horizontal" />
						</template>
					</el-button>

					<template #dropdown>
						<el-dropdown-menu>
							<!-- Removing an extension is not supported yet: the item says why -->
							<el-dropdown-item
								disabled
								class="text-danger!"
							>
								<span class="flex flex-col">
									{{ t('extensionsModule.buttons.remove') }}
									<span class="text-caption">{{ removeDisabledReason }}</span>
								</span>
							</el-dropdown-item>
						</el-dropdown-menu>
					</template>
				</el-dropdown>
			</el-tooltip>
		</footer>
	</article>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu, ElSwitch, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { StatusTag } from '../../../common';
import { ExtensionKind } from '../extensions.constants';

import type { IExtensionCardEmits, IExtensionCardProps } from './extension-card.types';

defineOptions({
	name: 'ExtensionCard',
});

const props = defineProps<IExtensionCardProps>();

const emit = defineEmits<IExtensionCardEmits>();

const { t } = useI18n();

const titleId = useId();

const extensionIcon = computed<string>(() => (props.extension.kind === ExtensionKind.module ? 'mdi:package-variant' : 'mdi:toy-brick'));

// "Module · Core", "Plugin · Add-on"
const kindLabel = computed<string>(() =>
	[
		props.extension.kind === ExtensionKind.module ? t('extensionsModule.labels.module') : t('extensionsModule.labels.plugin'),
		props.extension.isCore ? t('extensionsModule.labels.core') : t('extensionsModule.labels.addon'),
	].join(' · ')
);

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

const toggleDisabledReason = computed<string>(() => {
	if (props.extension.isCore && props.extension.kind === ExtensionKind.module) {
		return t('extensionsModule.tooltips.coreModuleCannotBeDisabled');
	}

	return t('extensionsModule.tooltips.cannotToggleEnabled');
});

const removeDisabledReason = computed<string>(() => {
	if (props.extension.isCore) {
		return t('extensionsModule.tooltips.coreCannotBeRemoved');
	}

	return t('extensionsModule.tooltips.removeNotSupported');
});
</script>
