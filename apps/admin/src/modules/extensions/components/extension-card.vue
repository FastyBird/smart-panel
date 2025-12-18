<template>
	<el-card
		class="extension-card"
		:class="{ 'extension-card--disabled': !extension.enabled }"
		shadow="hover"
		body-class="py-3!"
		footer-class="py-2! px-4!"
	>
		<template #header>
			<div class="extension-card__header">
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
					<el-tag
						:type="extension.enabled ? 'success' : 'info'"
						size="small"
					>
						{{ extension.enabled ? t('extensionsModule.labels.enabled') : t('extensionsModule.labels.disabled') }}
					</el-tag>
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
					<span>{{ extension.version }}</span>
				</div>
				<div
					v-if="extension.author"
					class="extension-card__author"
				>
					<icon
						icon="mdi:account"
						class="extension-card__author-icon"
					/>
					<span>{{ extension.author }}</span>
				</div>
			</div>
		</div>

		<template #footer>
			<div class="extension-card__footer">
				<div class="extension-card__links">
					<el-button
						v-if="extension.links?.documentation"
						type="primary"
						size="small"
						link
						@click.stop="openLink(extension.links.documentation)"
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
						@click.stop="openLink(extension.links.repository)"
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
						@click.stop="openLink(extension.links.bugsTracking)"
					>
						<icon
							icon="mdi:bug"
							class="mr-1"
						/>
						{{ t('extensionsModule.buttons.issues') }}
					</el-button>
				</div>

				<el-dropdown
					split-button
					size="small"
					trigger="click"
					@click="onDetailClick"
					@command="onDropdownCommand"
				>
					{{ t('extensionsModule.buttons.detail.title') }}
					<template #dropdown>
						<el-dropdown-menu>
							<el-tooltip
								:content="toggleDisabledReason"
								:disabled="extension.canToggleEnabled"
								placement="left"
							>
								<el-dropdown-item
									:command="extension.enabled ? 'disable' : 'enable'"
									:disabled="!extension.canToggleEnabled"
								>
									<icon
										:icon="extension.enabled ? 'mdi:toggle-switch-off' : 'mdi:toggle-switch'"
										class="mr-2"
									/>
									{{ extension.enabled ? t('extensionsModule.buttons.disable') : t('extensionsModule.buttons.enable') }}
								</el-dropdown-item>
							</el-tooltip>
							<el-tooltip
								:content="removeDisabledReason"
								placement="left"
							>
								<el-dropdown-item
									command="delete"
									disabled
									divided
								>
									<icon
										icon="mdi:delete"
										class="mr-2"
									/>
									{{ t('extensionsModule.buttons.remove') }}
								</el-dropdown-item>
							</el-tooltip>
						</el-dropdown-menu>
					</template>
				</el-dropdown>
			</div>
		</template>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCard, ElDropdown, ElDropdownItem, ElDropdownMenu, ElTag, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { ExtensionKind } from '../extensions.constants';

import type { IExtensionCardEmits, IExtensionCardProps } from './extension-card.types';

defineOptions({
	name: 'ExtensionCard',
});

const props = defineProps<IExtensionCardProps>();

const emit = defineEmits<IExtensionCardEmits>();

const { t } = useI18n();

const extensionIcon = computed<string>(() => {
	if (props.extension.kind === ExtensionKind.MODULE) {
		return 'mdi:package-variant';
	}
	return 'mdi:toy-brick';
});

const toggleDisabledReason = computed<string>(() => {
	if (props.extension.isCore && props.extension.kind === ExtensionKind.MODULE) {
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

const onDetailClick = (): void => {
	emit('detail', props.extension.type);
};

const onDropdownCommand = (command: string): void => {
	switch (command) {
		case 'enable':
			emit('toggle-enabled', props.extension.type, true);
			break;
		case 'disable':
			emit('toggle-enabled', props.extension.type, false);
			break;
		case 'delete':
			// Not yet supported
			break;
	}
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
	align-items: center;
	gap: 0.75rem;
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
	justify-content: space-between;
	height: 5.5rem;
}

.extension-card__description {
	margin: 0;
	color: var(--el-text-color-regular);
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
	line-height: 1.5;
}

.extension-card__description--empty {
	font-style: italic;
	color: var(--el-text-color-secondary);
}

.extension-card__meta {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.extension-card__meta-item {
	display: flex;
	align-items: center;
	gap: 0.25rem;
	font-size: 0.8125rem;
	color: var(--el-text-color-secondary);
}

.extension-card__meta-icon {
	font-size: 0.875rem;
}

.extension-card__author {
	display: flex;
	align-items: center;
	gap: 0.25rem;
	font-size: 0.75rem;
	color: var(--el-text-color-placeholder);
}

.extension-card__author-icon {
	font-size: 0.875rem;
}

.extension-card__footer {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 0.5rem;
}

.extension-card__links {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
}

</style>
