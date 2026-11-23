<template>
	<div
		class="flex flex-col gap-3 h-full p-4 box-border"
		data-test-id="provider-card"
	>
		<!-- The providerCard slot (spec section 7): icon, name, status, one line, up to two endpoints and one action. The
			host frame around it (equal heights, the active border) belongs to the providers catalogue -->
		<div class="flex items-start gap-3">
			<span class="flex items-center justify-center shrink-0 w-10 h-10 rounded-lg bg-primary-soft text-primary">
				<icon
					:icon="props.icon"
					width="22"
					height="22"
				/>
			</span>
			<div class="flex flex-col items-start gap-1 flex-1 min-w-0">
				<h3 class="m-0 max-w-full text-card-title truncate">{{ props.title }}</h3>
				<status-tag
					:status="props.status"
					:label="props.statusLabel"
				/>
			</div>
		</div>

		<p
			v-if="props.line.text"
			:class="['flex items-start gap-1.5 m-0 text-body', lineClass]"
			:data-status="props.line.status"
			data-test-id="provider-card-line"
		>
			<icon
				v-if="lineIcon"
				:icon="lineIcon"
				width="16"
				height="16"
				class="shrink-0 mt-[3px]"
			/>
			<span class="min-w-0 break-words">{{ props.line.text }}</span>
		</p>

		<div
			v-if="shownEndpoints.length > 0"
			class="flex flex-col gap-2"
		>
			<copy-field
				v-for="endpoint in shownEndpoints"
				:key="endpoint"
				:value="endpoint"
				data-test-id="provider-card-endpoint"
			/>
		</div>

		<div
			v-if="props.action || menuItems.length > 0"
			class="flex items-center gap-2 mt-auto pt-1"
		>
			<span class="flex-1" />

			<el-dropdown
				v-if="menuItems.length > 0"
				trigger="click"
				placement="bottom-end"
				@command="(key: string): void => emit('action', key)"
			>
				<el-button
					:aria-label="t('remoteAccessModule.buttons.more.title', { provider: props.title })"
					text
					circle
					data-test-id="provider-card-menu"
				>
					<template #icon>
						<icon icon="mdi:dots-horizontal" />
					</template>
				</el-button>

				<template #dropdown>
					<el-dropdown-menu>
						<el-dropdown-item
							v-for="(item, index) in menuItems"
							:key="item.key"
							:command="item.key"
							:disabled="item.disabled"
							:divided="item.danger === true && index > 0 && menuItems[index - 1].danger !== true"
							:class="item.danger ? 'text-danger!' : undefined"
							:data-menu-key="item.key"
						>
							{{ item.label }}
						</el-dropdown-item>
					</el-dropdown-menu>
				</template>
			</el-dropdown>

			<el-button
				v-if="props.action"
				:type="props.action.primary ? 'primary' : undefined"
				:loading="props.action.loading"
				:disabled="props.action.disabled"
				data-test-id="provider-card-action"
				@click="emit('action', props.action.key)"
			>
				{{ props.action.label }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus';

import { Icon } from '@iconify/vue';

import { CopyField, StatusTag } from '../../../common';

import type { IProviderCardMenuItem, IProviderCardProps } from './provider-card.types';

defineOptions({
	name: 'ProviderCard',
});

const props = withDefaults(defineProps<IProviderCardProps>(), {
	endpoints: () => [],
	action: null,
	menu: () => [],
});

const emit = defineEmits<{
	/** The action or a menu item was chosen, by its key */
	(e: 'action', key: string): void;
}>();

const { t } = useI18n();

const MAX_ENDPOINTS = 2;

const shownEndpoints = computed<string[]>(() => [...new Set(props.endpoints)].slice(0, MAX_ENDPOINTS));

// Destructive items go last, after one divider
const menuItems = computed<IProviderCardMenuItem[]>(() => [...props.menu.filter((item) => !item.danger), ...props.menu.filter((item) => item.danger)]);

const lineClass = computed<string>(() => {
	switch (props.line.status) {
		case 'danger':
			return 'text-danger';
		case 'warn':
			return 'text-warning';
		default:
			return '';
	}
});

const lineIcon = computed<string | null>(() => {
	switch (props.line.status) {
		case 'danger':
			return 'mdi:alert-circle';
		case 'warn':
			return 'mdi:alert-circle-outline';
		case 'info':
			return 'mdi:information-outline';
		default:
			return null;
	}
});
</script>
