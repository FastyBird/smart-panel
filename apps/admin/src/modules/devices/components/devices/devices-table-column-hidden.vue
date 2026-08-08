<template>
	<div
		v-if="props.device.hidden"
		class="flex items-center gap-1 mt-1"
	>
		<el-tag
			size="small"
			type="info"
		>
			{{ t('devicesModule.hidden.badge') }}
		</el-tag>

		<el-tooltip
			:content="hiddenByHint"
			placement="top"
			:show-after="500"
		>
			<el-tag
				size="small"
				:type="isSystemHidden ? 'warning' : 'primary'"
			>
				{{ hiddenByLabel }}
			</el-tag>
		</el-tooltip>

		<!-- Offered for a *user* hide only. That kind has no other way back: nothing reverses it, and the
			wizard's own hint tells the operator the source can be made visible again from this list.
			A system hide is owned by the virtual device that caused it and reverses itself when the last
			virtual device referencing the source is deleted. Unhiding it by hand undoes half of that
			arrangement and nothing restores the other half — the listener only unhides sources nothing
			references and never re-hides one that is still in use — so the physical source and its
			replacement would both sit in the list, both commandable, with no way back but hiding it again
			by hand. The provenance tag beside this says which kind it is, and its tooltip says how a
			system hide ends. -->
		<el-button
			v-if="!isSystemHidden"
			link
			size="small"
			type="primary"
			:loading="unhiding"
			data-test-id="unhide-device"
			@click="onUnhide"
		>
			{{ t('devicesModule.hidden.unhide') }}
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElTag, ElTooltip } from 'element-plus';

import { injectStoresManager, useFlashMessage, useLogger } from '../../../../common';
import { DevicesModuleDeviceHiddenBy } from '../../../../openapi.constants';
import { devicesStoreKey } from '../../store/keys';

import type { IDevicesTableColumnHiddenProps } from './devices-table-column-hidden.types';

defineOptions({
	name: 'DevicesTableColumnHidden',
});

const props = defineProps<IDevicesTableColumnHiddenProps>();

const { t } = useI18n();
const logger = useLogger();
const flashMessage = useFlashMessage();
const devicesStore = injectStoresManager().getStore(devicesStoreKey);

const unhiding = ref<boolean>(false);

// Only `hidden` is sent. The backend clears the provenance itself when a device becomes visible,
// which is what makes this expressible at all: no client can send `hidden_by: null` — the generated
// update type drops the null, and the DTO reads an explicit null as "not provided".
const onUnhide = async (): Promise<void> => {
	unhiding.value = true;

	try {
		await devicesStore.edit({ id: props.device.id, data: { type: props.device.type, hidden: false } });

		flashMessage.success(t('devicesModule.messages.devices.unhidden', { device: props.device.name }));
	} catch (error: unknown) {
		logger.error('Failed to unhide device', error);

		flashMessage.error(t('devicesModule.messages.devices.notUnhidden', { device: props.device.name }));
	} finally {
		unhiding.value = false;
	}
};

// `hiddenBy` is only ever `system` or `user` in practice, but the model allows `null` (e.g. a
// legacy row hidden before provenance tracking existed). Anything that is not confirmed `system`
// is treated as a user hide, since that is the safer assumption: it will not go away on its own.
const isSystemHidden = computed<boolean>((): boolean => props.device.hiddenBy === DevicesModuleDeviceHiddenBy.system);

const hiddenByLabel = computed<string>((): string => {
	return isSystemHidden.value ? t('devicesModule.hidden.by.system') : t('devicesModule.hidden.by.user');
});

const hiddenByHint = computed<string>((): string => {
	return isSystemHidden.value ? t('devicesModule.hidden.hint.system') : t('devicesModule.hidden.hint.user');
});
</script>
