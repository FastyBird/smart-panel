<template>
	<el-card shadow="never" class="mt-4">
		<template #header>
			<span class="font-medium">{{ t('spacesModule.detail.displays.title') }}</span>
		</template>

		<div v-loading="loading">
			<template v-if="displays.length > 0">
				<div
					v-for="display in displays"
					:key="display.id"
					class="flex items-center justify-between p-3 border-b last:border-b-0"
				>
					<div class="flex items-center gap-3">
						<el-avatar :size="40">
							<icon icon="mdi:monitor" class="w[24px] h[24px]" />
						</el-avatar>
						<div>
							<div class="font-medium">{{ display.name || display.macAddress }}</div>
							<div class="text-xs text-gray-500">
								{{ display.macAddress }}
							</div>
						</div>
					</div>

					<div class="flex items-center gap-2">
						<el-tag
							:type="display.online ? 'success' : 'danger'"
							size="small"
						>
							{{ display.online ? 'Online' : 'Offline' }}
						</el-tag>

						<el-button
							size="small"
							@click="onReassignDisplay(display)"
						>
							<template #icon>
								<icon icon="mdi:swap-horizontal" />
							</template>
							{{ t('spacesModule.detail.displays.reassign') }}
						</el-button>
					</div>
				</div>
			</template>

			<el-empty
				v-else
				:description="t('spacesModule.detail.displays.empty')"
				:image-size="60"
			/>
		</div>
	</el-card>

	<!-- Reassign Display Dialog -->
	<el-dialog
		v-model="showReassignDialog"
		:title="t('spacesModule.detail.displays.reassign')"
		width="400px"
	>
		<p class="mb-4">{{ t('spacesModule.detail.displays.selectRoom') }}</p>

		<el-select
			v-model="selectedTargetSpace"
			:placeholder="t('spacesModule.onboarding.selectSpace')"
			clearable
			class="w-full"
		>
			<el-option
				v-for="space in roomSpaces"
				:key="space.id"
				:label="space.name"
				:value="space.id"
				:disabled="space.id === props.spaceId"
			/>
		</el-select>

		<template #footer>
			<el-button @click="showReassignDialog = false">
				{{ t('spacesModule.buttons.cancel.title') }}
			</el-button>
			<el-button type="primary" :loading="isReassigning" @click="confirmReassign">
				{{ t('spacesModule.buttons.save.title') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, toRef } from 'vue';

import { Icon } from '@iconify/vue';
import {
	ElAvatar,
	ElButton,
	ElCard,
	ElDialog,
	ElEmpty,
	ElOption,
	ElSelect,
	ElTag,
	vLoading,
} from 'element-plus';
import { useI18n } from 'vue-i18n';

import { injectStoresManager, useFlashMessage } from '../../../common';
import type { IDisplay } from '../../displays/store/displays.store.types';
import { useSpaceDisplays } from '../composables';
import { SpaceType } from '../spaces.constants';
import { spacesStoreKey } from '../store';

import type { ISpaceDisplaysSectionProps } from './space-displays-section.types';

defineOptions({
	name: 'SpaceDisplaysSection',
});

const props = defineProps<ISpaceDisplaysSectionProps>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const storesManager = injectStoresManager();
const spacesStore = storesManager.getStore(spacesStoreKey);

const spaceIdRef = toRef(props, 'spaceId');

const {
	displays,
	loading,
	fetchDisplays,
	reassignDisplay,
} = useSpaceDisplays(spaceIdRef);

const showReassignDialog = ref(false);
const selectedDisplay = ref<IDisplay | null>(null);
const selectedTargetSpace = ref<string | null>(null);
const isReassigning = ref(false);

// Get all room-type spaces for reassignment
const roomSpaces = computed(() => {
	return spacesStore.findAll().filter((space) => space.type === SpaceType.ROOM);
});

const onReassignDisplay = (display: IDisplay): void => {
	selectedDisplay.value = display;
	selectedTargetSpace.value = null;
	showReassignDialog.value = true;
};

const confirmReassign = async (): Promise<void> => {
	if (!selectedDisplay.value) return;

	isReassigning.value = true;

	try {
		await reassignDisplay(selectedDisplay.value.id, selectedTargetSpace.value);
		showReassignDialog.value = false;
		flashMessage.success(t('spacesModule.messages.edited', { space: selectedDisplay.value.name || selectedDisplay.value.macAddress }));
	} catch {
		flashMessage.error(t('spacesModule.messages.saveError'));
	} finally {
		isReassigning.value = false;
	}
};

onMounted(async () => {
	await fetchDisplays();
});
</script>
