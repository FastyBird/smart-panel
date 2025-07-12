<template>
	<el-row
		justify="center"
		class="cursor-pointer"
		@click="onRestart"
	>
		<el-col
			:span="3"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<el-avatar :size="32">
					<icon
						icon="mdi:restart"
						class="w[20px] h[20px]"
					/>
				</el-avatar>
			</div>
		</el-col>
		<el-col :span="19">
			<el-text
				size="large"
				class="block font-600 text-lg"
			>
				{{ t('systemModule.headings.restart') }}
			</el-text>
			<el-text
				class="block"
				data-test-id="restart-info"
			>
				{{ t('systemModule.texts.rebootDevice') }}
			</el-text>
		</el-col>
		<el-col
			:span="2"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<icon
					icon="mdi:keyboard-arrow-right"
					class="w[32px] h[32px]"
				/>
			</div>
		</el-col>
	</el-row>

	<el-divider />

	<el-row
		justify="center"
		class="cursor-pointer"
		@click="onPowerOff"
	>
		<el-col
			:span="3"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<el-avatar :size="32">
					<icon
						icon="mdi:power-settings-new"
						class="w[20px] h[20px]"
					/>
				</el-avatar>
			</div>
		</el-col>
		<el-col :span="19">
			<el-text
				size="large"
				class="block font-600 text-lg"
			>
				{{ t('systemModule.headings.powerOff') }}
			</el-text>
			<el-text
				class="block"
				data-test-id="power-off-info"
			>
				{{ t('systemModule.texts.powerOffDevice') }}
			</el-text>
		</el-col>
		<el-col
			:span="2"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<icon
					icon="mdi:keyboard-arrow-right"
					class="w[32px] h[32px]"
				/>
			</div>
		</el-col>
	</el-row>

	<el-divider />

	<el-row
		justify="center"
		class="mb-4 cursor-pointer"
		@click="onFactoryReset"
	>
		<el-col
			:span="3"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<el-avatar :size="32">
					<icon
						icon="mdi:vacuum-cleaner"
						class="w[20px] h[20px]"
					/>
				</el-avatar>
			</div>
		</el-col>
		<el-col :span="19">
			<el-text
				size="large"
				class="block font-600 text-lg"
			>
				{{ t('systemModule.headings.factoryReset') }}
			</el-text>
			<el-text
				class="block"
				data-test-id="factory-reset-info"
			>
				{{ t('systemModule.texts.factoryResetDevice') }}
			</el-text>
		</el-col>
		<el-col
			:span="2"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<icon
					icon="mdi:keyboard-arrow-right"
					class="w[32px] h[32px]"
				/>
			</div>
		</el-col>
	</el-row>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElAvatar, ElCol, ElDivider, ElRow, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useSystemActions } from '../composables/composables';

defineOptions({
	name: 'ManageSystem',
});

const { t } = useI18n();
const { onRestart, onPowerOff, onFactoryReset } = useSystemActions();
</script>
