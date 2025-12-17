<template>
	<el-card
		class="extension-card"
		:class="{ 'extension-card--disabled': !extension.enabled }"
		shadow="hover"
	>
		<template #header>
			<div class="extension-card__header">
				<div class="extension-card__title-row">
					<icon
						:icon="extensionIcon"
						class="extension-card__icon"
					/>
					<div class="extension-card__title-container">
						<h3 class="extension-card__title">{{ extension.name }}</h3>
						<el-tag
							:type="extension.kind === ExtensionKind.MODULE ? 'primary' : 'success'"
							size="small"
							class="extension-card__kind-tag"
						>
							{{ extension.kind === ExtensionKind.MODULE ? t('extensionsModule.labels.module') : t('extensionsModule.labels.plugin') }}
						</el-tag>
						<el-tag
							v-if="extension.isCore"
							type="warning"
							size="small"
							class="extension-card__core-tag"
						>
							{{ t('extensionsModule.labels.core') }}
						</el-tag>
					</div>
				</div>
				<div class="extension-card__actions">
					<el-switch
						:model-value="extension.enabled"
						:disabled="!extension.canToggleEnabled"
						:active-text="t('extensionsModule.labels.enabled')"
						:inactive-text="t('extensionsModule.labels.disabled')"
						@change="onToggleEnabled"
					/>
					<el-tooltip
						:content="extension.isCore ? t('extensionsModule.tooltips.coreCannotBeRemoved') : t('extensionsModule.tooltips.removeNotSupported')"
						placement="top"
					>
						<el-button
							type="danger"
							size="small"
							:icon="DeleteIcon"
							circle
							disabled
						/>
					</el-tooltip>
				</div>
			</div>
		</template>

		<div class="extension-card__content">
			<p
				v-if="extension.description"
				class="extension-card__description"
			>
				{{ extension.description }}
			</p>
			<p
				v-else
				class="extension-card__description extension-card__description--empty"
			>
				{{ t('extensionsModule.messages.noDescription') }}
			</p>

			<div class="extension-card__meta">
				<div
					v-if="extension.version"
					class="extension-card__meta-item"
				>
					<icon
						icon="mdi:tag"
						class="extension-card__meta-icon"
					/>
					<span>{{ t('extensionsModule.labels.version') }}: {{ extension.version }}</span>
				</div>
				<div
					v-if="extension.author"
					class="extension-card__meta-item"
				>
					<icon
						icon="mdi:account"
						class="extension-card__meta-icon"
					/>
					<span>{{ t('extensionsModule.labels.author') }}: {{ extension.author }}</span>
				</div>
			</div>

			<div class="extension-card__footer">
				<div
					v-if="hasLinks"
					class="extension-card__links"
				>
					<el-button
						v-if="extension.links?.documentation"
						type="primary"
						size="small"
						link
						@click="openLink(extension.links.documentation)"
					>
						<icon
							icon="mdi:book-open-page-variant"
							class="mr-1"
						/>
						{{ t('extensionsModule.buttons.documentation') }}
					</el-button>
					<el-button
						v-if="extension.links?.repository"
						type="primary"
						size="small"
						link
						@click="openLink(extension.links.repository)"
					>
						<icon
							icon="mdi:github"
							class="mr-1"
						/>
						{{ t('extensionsModule.buttons.repository') }}
					</el-button>
					<el-button
						v-if="extension.links?.bugsTracking"
						type="primary"
						size="small"
						link
						@click="openLink(extension.links.bugsTracking)"
					>
						<icon
							icon="mdi:bug"
							class="mr-1"
						/>
						{{ t('extensionsModule.buttons.issues') }}
					</el-button>
				</div>

				<div class="extension-card__actions-bottom">
					<el-button
						size="small"
						@click="onDetailClick"
					>
						<icon
							icon="mdi:information-outline"
							class="mr-1"
						/>
						{{ t('extensionsModule.buttons.viewDetails') }}
					</el-button>
				</div>
			</div>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { computed, h } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCard, ElSwitch, ElTag, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { ExtensionKind } from '../extensions.constants';

import type { IExtensionCardEmits, IExtensionCardProps } from './extension-card.types';

const DeleteIcon = h(Icon, { icon: 'mdi:delete' });

defineOptions({
	name: 'ExtensionCard',
});

const props = defineProps<IExtensionCardProps>();

const emit = defineEmits<IExtensionCardEmits>();

const { t } = useI18n();

const extensionIcon = computed<string>(() => {
	if (props.extension.kind === ExtensionKind.MODULE) {
		return 'mdi:cube-outline';
	}
	return 'mdi:puzzle';
});

const hasLinks = computed<boolean>(() => {
	return !!(
		props.extension.links?.documentation ||
		props.extension.links?.repository ||
		props.extension.links?.bugsTracking
	);
});

const onToggleEnabled = (value: boolean | string | number): void => {
	emit('toggle-enabled', props.extension.type, value as boolean);
};

const onDetailClick = (): void => {
	emit('detail', props.extension.type);
};

const openLink = (url: string): void => {
	window.open(url, '_blank', 'noopener,noreferrer');
};
</script>

<style scoped>
.extension-card {
	transition: opacity 0.2s ease;
}

.extension-card--disabled {
	opacity: 0.7;
}

.extension-card__header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 1rem;
}

.extension-card__title-row {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	min-width: 0;
	flex: 1;
}

.extension-card__icon {
	font-size: 1.5rem;
	flex-shrink: 0;
	color: var(--el-color-primary);
}

.extension-card__title-container {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 0.5rem;
	min-width: 0;
}

.extension-card__title {
	margin: 0;
	font-size: 1rem;
	font-weight: 600;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.extension-card__kind-tag,
.extension-card__core-tag {
	flex-shrink: 0;
}

.extension-card__content {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.extension-card__description {
	margin: 0;
	color: var(--el-text-color-regular);
	line-height: 1.5;
}

.extension-card__description--empty {
	font-style: italic;
	color: var(--el-text-color-secondary);
}

.extension-card__meta {
	display: flex;
	flex-wrap: wrap;
	gap: 1rem;
}

.extension-card__meta-item {
	display: flex;
	align-items: center;
	gap: 0.25rem;
	font-size: 0.875rem;
	color: var(--el-text-color-secondary);
}

.extension-card__meta-icon {
	font-size: 1rem;
}

.extension-card__actions {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	flex-shrink: 0;
}

.extension-card__footer {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	margin-top: 0.5rem;
	padding-top: 0.75rem;
	border-top: 1px solid var(--el-border-color-lighter);
}

.extension-card__links {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
}

.extension-card__actions-bottom {
	display: flex;
	justify-content: flex-end;
	gap: 0.5rem;
}
</style>
