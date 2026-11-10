<template>
	<div class="flex flex-col gap-4">
		<el-alert
			v-if="loadError"
			type="error"
			:closable="false"
			show-icon
			:title="loadError"
		/>

		<div v-if="loading">
			{{ t('devicesModbusPlugin.wizard.template.loading') }}
		</div>

		<div class="grid gap-3 lt-sm:grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
			<el-card
				v-for="template in templates"
				:key="template.id"
				shadow="hover"
				class="cursor-pointer"
				:class="{ 'border-[var(--el-color-primary)]!': wizard.state.template?.id === template.id }"
				:data-test-id="`template-${template.id}`"
				@click="onSelect(template.id)"
			>
				<div class="font-bold">
					{{ template.name }}
				</div>
				<div class="text-sm">
					{{ [template.manufacturer, template.model].filter((part) => part !== '').join(' ') }}
				</div>
				<div class="mt-2 flex flex-wrap gap-1">
					<el-tag
						size="small"
						:type="template.source === 'builtin' ? 'info' : 'success'"
					>
						{{
							template.source === 'builtin'
								? t('devicesModbusPlugin.wizard.template.source.builtin')
								: t('devicesModbusPlugin.wizard.template.source.user')
						}}
					</el-tag>
					<el-tag
						v-if="template.overridesBuiltin"
						size="small"
						type="warning"
					>
						{{ t('devicesModbusPlugin.wizard.template.overrides') }}
					</el-tag>
				</div>
				<div class="text-xs mt-2">
					{{ t('devicesModbusPlugin.wizard.template.counts', { channels: template.channelCount, points: template.pointCount }) }}
				</div>
			</el-card>

			<el-card
				shadow="hover"
				class="cursor-pointer"
				:class="{ 'border-[var(--el-color-primary)]!': wizard.state.startedEmpty }"
				data-test-id="template-start-empty"
				@click="wizard.startEmpty()"
			>
				<div class="font-bold">
					{{ t('devicesModbusPlugin.wizard.template.startEmpty.title') }}
				</div>
				<div class="text-sm">
					{{ t('devicesModbusPlugin.wizard.template.startEmpty.description') }}
				</div>
			</el-card>
		</div>

		<div v-if="!loading && templates.length === 0">
			{{ t('devicesModbusPlugin.wizard.template.none') }}
		</div>

		<div v-if="fileErrors.length > 0">
			<el-alert
				type="warning"
				:closable="false"
				show-icon
				:title="t('devicesModbusPlugin.wizard.template.fileErrors')"
			>
				<ul class="m-0 pl-4 text-xs">
					<li
						v-for="(row, index) in fileErrors"
						:key="index"
					>
						{{ row.path }}: {{ row.error }}
					</li>
				</ul>
			</el-alert>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElCard, ElTag } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../../common';
import { modbusTemplatesStoreKey } from '../../store/keys';
import type { IModbusTemplateSummary } from '../../store/templates.types';

import type { IModbusWizardTemplateStepProps } from './modbus-wizard-template-step.types';

defineOptions({
	name: 'ModbusWizardTemplateStep',
});

const props = defineProps<IModbusWizardTemplateStepProps>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const templatesStore = injectStoresManager().getStore(modbusTemplatesStoreKey);

const loading = ref<boolean>(false);
const loadError = ref<string | null>(null);

const templates = computed<IModbusTemplateSummary[]>(() => templatesStore.catalog?.templates ?? []);

const fileErrors = computed<{ path: string; error: string }[]>(() =>
	(templatesStore.catalog?.files ?? []).flatMap((file) => file.errors.map((error) => ({ path: file.path, error })))
);

const onSelect = async (id: string): Promise<void> => {
	if (props.wizard.applyingTemplate.value) {
		return;
	}

	try {
		await props.wizard.applyTemplate(id);
	} catch (error: unknown) {
		flashMessage.error(error instanceof Error ? error.message : t('devicesModbusPlugin.wizard.template.applyFailed'));
	}
};

onMounted(async () => {
	if (templatesStore.catalog !== null) {
		return;
	}

	loading.value = true;

	try {
		await templatesStore.fetch();
	} catch (error: unknown) {
		loadError.value = error instanceof Error ? error.message : t('devicesModbusPlugin.wizard.template.loadFailed');
	} finally {
		loading.value = false;
	}
});
</script>
