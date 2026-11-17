<template>
	<device-wizard-selection
		v-if="choosing"
		:key="type ?? 'select'"
		:title="selectionTitle"
		:description="selectionDescription"
		:sections="sections"
		:loading="!loaded && !loadError"
		:error="loadError"
		@select="router.push($event.to)"
		@retry="load"
		@manual="router.push({ name: RouteNames.DEVICES_ADD })"
	/>
	<device-wizard-shell
		v-else
		:key="`${type}:${variant?.id ?? ''}`"
		:title="title"
		:subtitle="plugin?.description"
		:back-route="backRoute"
	>
		<el-alert
			v-if="loadError"
			:title="t('devicesModule.wizard.loadFailed')"
			type="error"
			:closable="false"
		>
			<el-button @click="load">{{ t('devicesModule.wizard.retry') }}</el-button>
		</el-alert>
		<div
			v-else-if="!loaded"
			v-loading="true"
			class="h-30"
		/>
		<component
			:is="content"
			v-else-if="content && enabled(type!)"
			v-bind="contentProps"
		/>
		<entity-not-found
			v-else
			icon="mdi:wizard-hat"
			:message="t('devicesModule.texts.devices.noWizardForDevicePlugin', { type })"
			:button-label="t('devicesModule.buttons.back.title')"
			@back="router.push({ name: RouteNames.DEVICES_WIZARD_SELECT })"
		/>
	</device-wizard-shell>
</template>
<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { ElAlert, ElButton, vLoading } from 'element-plus';

import { EntityNotFound } from '../../../common';
import { useConfigPlugins } from '../../config';
import type { IDeviceWizardSelectionChoice, IDeviceWizardSelectionSection } from '../components/wizard/device-wizard-selection.types';
import DeviceWizardSelection from '../components/wizard/device-wizard-selection.vue';
import DeviceWizardShell from '../components/wizard/device-wizard-shell.vue';
import { useDevicesPlugins } from '../composables/useDevicesPlugins';
import { RouteNames } from '../devices.constants';
import type { IDeviceWizardDefinition } from '../devices.types';

const props = defineProps<{ type?: string }>();
const route = useRoute(),
	router = useRouter();
const { t } = useI18n();
const { getByPluginType, getWizard, wizardOptions } = useDevicesPlugins();
const { enabled, loaded, fetchConfigPlugins } = useConfigPlugins();
const loadError = ref(false);
const load = async () => {
	loadError.value = false;
	try {
		await fetchConfigPlugins();
	} catch {
		loadError.value = true;
	}
};
onBeforeMount(load);
const plugin = computed(() => (props.type ? getByPluginType(props.type) : undefined));
const definition = computed(() => (props.type ? getWizard(props.type) : undefined));
const variantId = computed(() =>
	typeof route.query.variant === 'string'
		? route.query.variant
		: definition.value?.variants?.length === 1
			? definition.value.variants[0]?.id
			: undefined
);
const variant = computed(() => definition.value?.variants?.find((item) => item.id === variantId.value));
const content = computed(() => (variantId.value ? variant.value?.component : definition.value?.component));
const contentProps = computed(() => variant.value?.props ?? definition.value?.props ?? {});
const choosing = computed(() => !props.type || (enabled(props.type) && !!definition.value?.variants?.length && !variantId.value));
const title = computed(() => (variant.value ? t(variant.value.label) : (plugin.value?.name ?? t('devicesModule.wizard.selection.title'))));
const selectionTitle = computed(() => {
	const selection = definition.value?.selection;
	return selection?.kind === 'section'
		? t(selection.section.label)
		: selection?.label
			? t(selection.label)
			: (plugin.value?.name ?? t('devicesModule.wizard.selection.title'));
});
const selectionDescription = computed(() => {
	const selection = definition.value?.selection;
	return selection?.kind === 'section'
		? t(selection.section.description)
		: selection?.description
			? t(selection.description)
			: (plugin.value?.description ?? t('devicesModule.wizard.selection.description'));
});
const variantChoices = (type: string, definition: IDeviceWizardDefinition, prefix: boolean): IDeviceWizardSelectionChoice[] =>
	(definition.variants ?? []).map((item) => ({
		id: prefix ? `${type}:${item.id}` : item.id,
		label: t(item.label),
		description: t(item.description),
		icon: item.icon,
		keywords: [getByPluginType(type)?.name ?? ''],
		to: { name: RouteNames.DEVICES_WIZARD, params: { type }, query: { variant: item.id } },
	}));
const sections = computed<IDeviceWizardSelectionSection[]>(() => {
	if (props.type)
		return definition.value && enabled(props.type)
			? [
					{
						id: props.type,
						label: t('devicesModule.wizard.variant'),
						description: '',
						choices: variantChoices(props.type, definition.value, false),
					},
				]
			: [];
	const integrations: (IDeviceWizardSelectionChoice & { order: number })[] = [];
	const customSections: (IDeviceWizardSelectionSection & { order: number })[] = [];
	for (const option of wizardOptions.value.filter((option) => !option.disabled)) {
		const wizard = getWizard(option.value);
		if (!wizard) continue;
		const selection = wizard.selection;
		const choice: IDeviceWizardSelectionChoice & { order: number } = {
			id: option.value,
			keywords: [option.label],
			label: selection?.label ? t(selection.label) : option.label,
			description: selection?.description ? t(selection.description) : option.description,
			icon: selection?.icon ?? getByPluginType(option.value)?.icon?.small ?? 'mdi:devices',
			order: selection?.order ?? 100,
			to: { name: RouteNames.DEVICES_WIZARD, params: { type: option.value } },
		};
		if (selection?.kind === 'section') {
			const label = t(selection.section.label);
			customSections.push({
				id: option.value,
				label,
				description: t(selection.section.description),
				order: selection.order ?? 100,
				choices: (wizard.variants ? variantChoices(option.value, wizard, true) : [choice]).map((item) => ({
					...item,
					keywords: [...(item.keywords ?? []), label],
				})),
			});
		} else integrations.push(choice);
	}
	return [
		...(integrations.length
			? [
					{
						id: 'integrations',
						label: t('devicesModule.wizard.selection.integrations'),
						description: t('devicesModule.wizard.selection.integrationsDescription'),
						choices: integrations.sort((left, right) => left.order - right.order || left.label.localeCompare(right.label)),
					},
				]
			: []),
		...customSections.sort((left, right) => left.order - right.order || left.label.localeCompare(right.label)),
	];
});
const backRoute = computed(() =>
	variantId.value && (definition.value?.variants?.length ?? 0) > 1 && definition.value?.selection?.kind !== 'section'
		? { name: RouteNames.DEVICES_WIZARD, params: { type: props.type } }
		: { name: RouteNames.DEVICES_WIZARD_SELECT }
);
</script>
