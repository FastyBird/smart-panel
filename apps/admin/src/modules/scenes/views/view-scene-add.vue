<template>
	<el-drawer v-model="isOpen" :title="t('scenes.headings.add')" direction="rtl" size="600px" @closed="onClose">
		<el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="scene-form">
			<!-- Room Selection -->
			<el-form-item :label="t('scenes.form.room')" prop="spaceId">
				<el-select
					v-model="form.spaceId"
					:placeholder="t('scenes.form.selectRoom')"
					:loading="spacesLoading"
					style="width: 100%"
				>
					<el-option v-for="room in rooms" :key="room.id" :label="room.name" :value="room.id" />
				</el-select>
			</el-form-item>

			<!-- Scene Name -->
			<el-form-item :label="t('scenes.form.name')" prop="name">
				<el-input v-model="form.name" :placeholder="t('scenes.form.namePlaceholder')" />
			</el-form-item>

			<!-- Category -->
			<el-form-item :label="t('scenes.form.category')" prop="category">
				<el-select v-model="form.category" style="width: 100%">
					<el-option
						v-for="cat in categories"
						:key="cat"
						:label="t(`scenes.categories.${cat}`)"
						:value="cat"
					/>
				</el-select>
			</el-form-item>

			<!-- Description -->
			<el-form-item :label="t('scenes.form.description')">
				<el-input
					v-model="form.description"
					type="textarea"
					:rows="2"
					:placeholder="t('scenes.form.descriptionPlaceholder')"
				/>
			</el-form-item>

			<!-- Actions Section -->
			<el-divider>{{ t('scenes.form.actionsSection') }}</el-divider>

			<div v-if="form.actions.length === 0" class="empty-actions">
				<el-empty :description="t('scenes.form.noActions')" :image-size="60" />
			</div>

			<div v-for="(action, index) in form.actions" :key="index" class="action-card">
				<div class="action-header">
					<span class="action-number">{{ t('scenes.form.actionNumber', { number: index + 1 }) }}</span>
					<el-button type="danger" size="small" text @click="removeAction(index)">
						<icon icon="mdi:delete" />
					</el-button>
				</div>

				<!-- Device Selection -->
				<el-form-item :label="t('scenes.form.device')" :prop="`actions.${index}.deviceId`" :rules="actionRules.deviceId">
					<el-select
						v-model="action.deviceId"
						:placeholder="t('scenes.form.selectDevice')"
						:loading="devicesLoading"
						style="width: 100%"
						@change="onDeviceChange(index)"
					>
						<el-option v-for="device in devices" :key="device.id" :label="device.name" :value="device.id" />
					</el-select>
				</el-form-item>

				<!-- Channel Selection -->
				<el-form-item
					v-if="action.deviceId"
					:label="t('scenes.form.channel')"
				>
					<el-select
						v-model="action.channelId"
						:placeholder="t('scenes.form.selectChannel')"
						style="width: 100%"
						@change="onChannelChange(index)"
					>
						<el-option
							v-for="channel in getChannelsForDevice(action.deviceId)"
							:key="channel.id"
							:label="channel.name ?? channel.identifier ?? channel.id"
							:value="channel.id"
						/>
					</el-select>
				</el-form-item>

				<!-- Property Selection -->
				<el-form-item
					v-if="action.channelId !== ''"
					:label="t('scenes.form.property')"
					:prop="`actions.${index}.propertyId`"
					:rules="actionRules.propertyId"
				>
					<el-select
						v-model="action.propertyId"
						:placeholder="t('scenes.form.selectProperty')"
						style="width: 100%"
						@change="onPropertyChange(index)"
					>
						<el-option
							v-for="prop in getWritablePropertiesForChannel(action.channelId)"
							:key="prop.id"
							:label="prop.name ?? prop.identifier ?? prop.id"
							:value="prop.id"
						/>
					</el-select>
				</el-form-item>

				<!-- Value Input -->
				<el-form-item
					v-if="action.propertyId"
					:label="t('scenes.form.value')"
					:prop="`actions.${index}.value`"
					:rules="actionRules.value"
				>
					<template v-if="getPropertyDataType(action.propertyId) === 'boolean'">
						<el-switch v-model="(action.value as boolean)" />
					</template>
					<template v-else-if="getPropertyDataType(action.propertyId) === 'number'">
						<el-input-number
							v-model="(action.value as number)"
							:min="getPropertyMin(action.propertyId)"
							:max="getPropertyMax(action.propertyId)"
							:step="getPropertyStep(action.propertyId)"
							style="width: 100%"
						/>
					</template>
					<template v-else-if="getPropertyFormat(action.propertyId)?.length">
						<el-select v-model="action.value" style="width: 100%">
							<el-option
								v-for="option in getPropertyFormat(action.propertyId)"
								:key="String(option)"
								:label="String(option)"
								:value="option"
							/>
						</el-select>
					</template>
					<template v-else>
						<el-input v-model="(action.value as string)" :placeholder="t('scenes.form.valuePlaceholder')" />
					</template>
				</el-form-item>
			</div>

			<el-button type="primary" plain style="width: 100%" @click="addAction">
				<template #icon>
					<icon icon="mdi:plus" />
				</template>
				{{ t('scenes.form.addAction') }}
			</el-button>
		</el-form>

		<template #footer>
			<el-button @click="onClose">{{ t('scenes.buttons.cancel') }}</el-button>
			<el-button type="primary" :loading="saving" @click="onSave">
				{{ t('scenes.buttons.save') }}
			</el-button>
		</template>
	</el-drawer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import {
	ElButton,
	ElDivider,
	ElDrawer,
	ElEmpty,
	ElForm,
	ElFormItem,
	ElInput,
	ElInputNumber,
	ElMessage,
	ElOption,
	ElSelect,
	ElSwitch,
	type FormInstance,
	type FormRules,
} from 'element-plus';
import { Icon } from '@iconify/vue';
import { v4 as uuid } from 'uuid';

import { injectStoresManager } from '../../../common';
import { DevicesModuleChannelPropertyPermissions } from '../../../openapi.constants';
import { useChannels, useDevices } from '../../devices/composables/composables';
import type { IChannelProperty } from '../../devices/store/channels.properties.store.types';
import type { IChannel } from '../../devices/store/channels.store.types';
import { channelsPropertiesStoreKey } from '../../devices/store/keys';
import { useSpaces } from '../../spaces/composables';
import { SpaceType } from '../../spaces/spaces.constants';
import { useScenesActions } from '../composables/useScenesActions';
import { RouteNames, SceneCategory } from '../scenes.constants';

interface IActionForm {
	deviceId: string;
	channelId: string;
	propertyId: string;
	value: string | number | boolean;
}

interface ISceneForm {
	spaceId: string;
	name: string;
	category: SceneCategory;
	description: string;
	actions: IActionForm[];
}

const LOCAL_SCENE_TYPE = 'local';

const { t } = useI18n();
const router = useRouter();

const storesManager = injectStoresManager();
const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

const { addScene } = useScenesActions();
const { spaces, fetching: spacesLoading, fetchSpaces } = useSpaces();
const { devices, areLoading: devicesLoading, fetchDevices } = useDevices();
const { channels, fetchChannels } = useChannels();

const properties = computed<IChannelProperty[]>(() => propertiesStore.findAll());

const fetchPropertiesForChannel = async (channelId: string): Promise<void> => {
	if (!channelId) return;
	await propertiesStore.fetch({ channelId });
};

const isOpen = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();

const form = reactive<ISceneForm>({
	spaceId: '',
	name: '',
	category: SceneCategory.GENERIC,
	description: '',
	actions: [],
});

const categories = Object.values(SceneCategory);

const rooms = computed(() => {
	return spaces.value.filter((space) => space.type === SpaceType.ROOM).sort((a, b) => a.name.localeCompare(b.name));
});

const rules: FormRules = {
	spaceId: [{ required: true, message: t('scenes.form.roomRequired'), trigger: 'change' }],
	name: [{ required: true, message: t('scenes.form.nameRequired'), trigger: 'blur' }],
	category: [{ required: true, message: t('scenes.form.categoryRequired'), trigger: 'change' }],
};

const actionRules = {
	deviceId: [{ required: true, message: t('scenes.form.deviceRequired'), trigger: 'change' }],
	propertyId: [{ required: true, message: t('scenes.form.propertyRequired'), trigger: 'change' }],
	value: [{ required: true, message: t('scenes.form.valueRequired'), trigger: 'change' }],
};

const getChannelsForDevice = (deviceId: string): IChannel[] => {
	return channels.value.filter((channel) => channel.device === deviceId);
};

const getWritablePropertiesForChannel = (channelId: string): IChannelProperty[] => {
	return properties.value.filter(
		(prop) =>
			prop.channel === channelId &&
			(prop.permissions.includes(DevicesModuleChannelPropertyPermissions.rw) ||
				prop.permissions.includes(DevicesModuleChannelPropertyPermissions.wo))
	);
};

const getProperty = (propertyId: string): IChannelProperty | undefined => {
	return properties.value.find((p) => p.id === propertyId);
};

const getPropertyDataType = (propertyId: string): string => {
	const prop = getProperty(propertyId);
	if (!prop) return 'string';

	const dt = prop.dataType?.toLowerCase();
	if (dt === 'bool' || dt === 'boolean') return 'boolean';
	if (['int', 'uint', 'float', 'short', 'ushort', 'char', 'uchar'].includes(dt || '')) return 'number';
	return 'string';
};

const getPropertyFormat = (propertyId: string): (string | number)[] | null => {
	const prop = getProperty(propertyId);
	const format = prop?.format;
	if (!format || !Array.isArray(format)) return null;
	return format.filter((f): f is string | number => f !== null);
};

const getPropertyMin = (propertyId: string): number | undefined => {
	const prop = getProperty(propertyId);
	const format = prop?.format;
	if (format && Array.isArray(format) && format.length >= 2) {
		const min = format[0];
		return typeof min === 'number' ? min : undefined;
	}
	return undefined;
};

const getPropertyMax = (propertyId: string): number | undefined => {
	const prop = getProperty(propertyId);
	const format = prop?.format;
	if (format && Array.isArray(format) && format.length >= 2) {
		const max = format[1];
		return typeof max === 'number' ? max : undefined;
	}
	return undefined;
};

const getPropertyStep = (propertyId: string): number => {
	const prop = getProperty(propertyId);
	return prop?.step || 1;
};

const onDeviceChange = (index: number): void => {
	form.actions[index].channelId = '';
	form.actions[index].propertyId = '';
	form.actions[index].value = '';

	// Fetch channels for the selected device
	const deviceId = form.actions[index].deviceId;
	if (deviceId) {
		fetchChannels();
	}
};

const onChannelChange = async (index: number): Promise<void> => {
	form.actions[index].propertyId = '';
	form.actions[index].value = '';

	// Fetch properties for the selected channel
	const channelId = form.actions[index].channelId;
	if (channelId) {
		await fetchPropertiesForChannel(channelId);
	}
};

const onPropertyChange = (index: number): void => {
	// Reset value when property changes
	const propertyId = form.actions[index].propertyId;
	const dataType = getPropertyDataType(propertyId);

	if (dataType === 'boolean') {
		form.actions[index].value = false;
	} else if (dataType === 'number') {
		// Use property minimum if defined, otherwise default to 0
		const min = getPropertyMin(propertyId);
		form.actions[index].value = min ?? 0;
	} else {
		form.actions[index].value = '';
	}
};

const addAction = (): void => {
	form.actions.push({
		deviceId: '',
		channelId: '',
		propertyId: '',
		value: '',
	});
};

const removeAction = (index: number): void => {
	form.actions.splice(index, 1);
};

const onClose = (): void => {
	isOpen.value = false;
	router.push({ name: RouteNames.SCENES });
};

const validateActions = (): boolean => {
	if (form.actions.length === 0) {
		ElMessage.error(t('scenes.form.actionsRequired'));
		return false;
	}

	for (let i = 0; i < form.actions.length; i++) {
		const action = form.actions[i];
		const actionNum = i + 1;

		if (!action.deviceId) {
			ElMessage.error(t('scenes.form.actionDeviceRequired', { number: actionNum }));
			return false;
		}

		if (!action.channelId) {
			ElMessage.error(t('scenes.form.actionChannelRequired', { number: actionNum }));
			return false;
		}

		if (!action.propertyId) {
			ElMessage.error(t('scenes.form.actionPropertyRequired', { number: actionNum }));
			return false;
		}

		// Check value is set (handle boolean false as valid)
		if (action.value === '' || action.value === undefined || action.value === null) {
			ElMessage.error(t('scenes.form.actionValueRequired', { number: actionNum }));
			return false;
		}
	}

	return true;
};

const onSave = async (): Promise<void> => {
	if (!formRef.value) return;

	try {
		await formRef.value.validate();
	} catch {
		return;
	}

	// Validate conditionally rendered action fields
	if (!validateActions()) {
		return;
	}

	saving.value = true;

	try {
		await addScene({
			id: uuid(),
			draft: false,
			data: {
				type: LOCAL_SCENE_TYPE,
				spaceId: form.spaceId,
				category: form.category,
				name: form.name,
				description: form.description || null,
				enabled: true,
				actions: form.actions.map((action, index) => ({
					id: uuid(),
					type: LOCAL_SCENE_TYPE,
					deviceId: action.deviceId,
					channelId: action.channelId || null,
					propertyId: action.propertyId,
					value: action.value,
					order: index,
					enabled: true,
				})),
			},
		});

		ElMessage.success(t('scenes.messages.created'));
		onClose();
	} catch {
		ElMessage.error(t('scenes.messages.createFailed'));
	} finally {
		saving.value = false;
	}
};

onMounted(async () => {
	isOpen.value = true;
	await Promise.all([fetchSpaces(), fetchDevices(), fetchChannels()]);
});
</script>

<style scoped>
.scene-form {
	padding: 0 20px;
}

.empty-actions {
	margin: 20px 0;
}

.action-card {
	background: var(--el-fill-color-light);
	border-radius: 8px;
	padding: 16px;
	margin-bottom: 16px;
}

.action-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 12px;
}

.action-number {
	font-weight: 600;
	color: var(--el-color-primary);
}
</style>
