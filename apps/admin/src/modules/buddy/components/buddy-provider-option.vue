<template>
	<div
		:class="['rounded-lg border border-solid', props.provider.enabled ? 'border-primary bg-primary-soft' : 'border-light']"
		:data-provider="props.provider.type"
		data-test-id="buddy-provider-option"
	>
		<!-- One provider a setup step can pick: chosen with its radio once it is on, switched on and off in place, and set
		     up with the plugin's own config form -->
		<div class="flex items-center gap-3 p-3">
			<el-radio
				:model-value="props.selected ? props.provider.type : undefined"
				:value="props.provider.type"
				:disabled="!props.provider.enabled"
				:aria-label="props.provider.name"
				:name="props.group"
				class="mr-0! shrink-0"
				@change="emit('select')"
			/>
			<div
				:class="['flex items-center gap-3 flex-1 min-w-0', props.provider.enabled ? 'cursor-pointer' : '']"
				@click="props.provider.enabled && emit('select')"
			>
				<el-icon
					:size="32"
					class="shrink-0"
					aria-hidden="true"
				>
					<icon
						:icon="props.icon"
						:class="props.provider.enabled ? 'text-primary' : 'text-muted'"
					/>
				</el-icon>
				<div class="flex flex-col flex-1 min-w-0">
					<span class="text-card-title">
						{{ props.provider.name }}
						<span
							v-if="props.model"
							class="text-caption ml-2"
						>
							{{ props.model }}
						</span>
					</span>
					<span
						v-if="props.provider.description"
						class="text-help line-clamp-2"
					>
						{{ props.provider.description }}
					</span>
				</div>
			</div>
			<el-switch
				:model-value="props.provider.enabled"
				:disabled="!props.canToggle || props.toggling"
				:loading="props.toggling"
				:aria-label="t('buddyModule.wizard.aria.enable', { name: props.provider.name })"
				@update:model-value="(val: string | number | boolean) => emit('toggle', !!val)"
			/>
		</div>

		<div
			v-if="props.provider.enabled"
			class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-t-solid border-primary-soft"
		>
			<status-tag
				:status="props.provider.configured ? 'ok' : 'warn'"
				:label="props.provider.configured ? t('buddyModule.wizard.configured') : t('buddyModule.wizard.configRequired')"
			/>
			<el-button
				v-if="props.hasConfigForm"
				text
				type="primary"
				data-test-id="buddy-provider-option-configure"
				@click="emit('configure')"
			>
				<template #icon>
					<icon icon="mdi:cog-outline" />
				</template>
				{{ t('buddyModule.wizard.buttons.configure') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElIcon, ElRadio, ElSwitch } from 'element-plus';

import { Icon } from '@iconify/vue';

import { StatusTag } from '../../../common';

defineOptions({
	name: 'BuddyProviderOption',
});

const props = withDefaults(
	defineProps<{
		provider: { type: string; name: string; description: string; enabled: boolean; configured: boolean };
		/** The radio group the option belongs to, one per kind of provider */
		group: string;
		icon: string;
		selected: boolean;
		model?: string;
		canToggle?: boolean;
		toggling?: boolean;
		hasConfigForm?: boolean;
	}>(),
	{
		model: undefined,
		canToggle: true,
		toggling: false,
		hasConfigForm: false,
	}
);

const emit = defineEmits<{
	(e: 'select'): void;
	(e: 'toggle', enabled: boolean): void;
	(e: 'configure'): void;
}>();

const { t } = useI18n();
</script>
