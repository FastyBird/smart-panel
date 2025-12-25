<template>
	<el-form ref="formRef" :model="formData" :rules="rules" label-position="top" @submit.prevent="onSubmit">
		<el-form-item :label="t('spacesModule.fields.spaces.name.title')" prop="name">
			<el-input v-model="formData.name" :placeholder="t('spacesModule.fields.spaces.name.placeholder')" />
		</el-form-item>

		<el-form-item :label="t('spacesModule.fields.spaces.type.title')" prop="type">
			<el-select v-model="formData.type" style="width: 100%">
				<el-option :label="t('spacesModule.fields.spaces.type.options.room')" :value="SpaceType.ROOM" />
				<el-option :label="t('spacesModule.fields.spaces.type.options.zone')" :value="SpaceType.ZONE" />
			</el-select>
		</el-form-item>

		<el-form-item :label="t('spacesModule.fields.spaces.description.title')" prop="description">
			<el-input
				v-model="formData.description"
				type="textarea"
				:rows="3"
				:placeholder="t('spacesModule.fields.spaces.description.placeholder')"
			/>
		</el-form-item>

		<el-form-item :label="t('spacesModule.fields.spaces.icon.title')" prop="icon">
			<el-input v-model="formData.icon" :placeholder="t('spacesModule.fields.spaces.icon.placeholder')">
				<template v-if="formData.icon" #prefix>
					<el-icon>
						<icon :icon="formData.icon" />
					</el-icon>
				</template>
			</el-input>
		</el-form-item>

		<el-form-item :label="t('spacesModule.fields.spaces.displayOrder.title')" prop="displayOrder">
			<el-input-number v-model="formData.displayOrder" :min="0" style="width: 100%" />
		</el-form-item>

		<div class="flex gap-2 justify-end mt-4">
			<el-button @click="onCancel">
				{{ t('spacesModule.buttons.cancel.title') }}
			</el-button>
			<el-button type="primary" :loading="saving" @click="onSubmit">
				{{ t('spacesModule.buttons.save.title') }}
			</el-button>
		</div>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';

import { Icon } from '@iconify/vue';
import { ElButton, ElForm, ElFormItem, ElIcon, ElInput, ElInputNumber, ElOption, ElSelect, type FormInstance, type FormRules } from 'element-plus';
import { useI18n } from 'vue-i18n';

import { injectStoresManager } from '../../../common';
import { SpaceType } from '../spaces.constants';
import { spacesStoreKey, type ISpace, type ISpaceCreateData } from '../store';

interface IProps {
	space?: ISpace;
}

interface IEmits {
	(e: 'saved', space: ISpace): void;
	(e: 'cancel'): void;
}

const props = withDefaults(defineProps<IProps>(), {
	space: undefined,
});

const emit = defineEmits<IEmits>();

const { t } = useI18n();

const storesManager = injectStoresManager();
const spacesStore = storesManager.getStore(spacesStoreKey);

const formRef = ref<FormInstance>();
const saving = ref(false);

const formData = reactive({
	name: props.space?.name ?? '',
	type: props.space?.type ?? SpaceType.ROOM,
	description: props.space?.description ?? '',
	icon: props.space?.icon ?? '',
	displayOrder: props.space?.displayOrder ?? 0,
});

const rules: FormRules = {
	name: [{ required: true, message: 'Name is required', trigger: 'blur' }],
};

watch(
	() => props.space,
	(space) => {
		if (space) {
			formData.name = space.name;
			formData.type = space.type;
			formData.description = space.description ?? '';
			formData.icon = space.icon ?? '';
			formData.displayOrder = space.displayOrder;
		}
	}
);

const onSubmit = async (): Promise<void> => {
	const valid = await formRef.value?.validate().catch(() => false);

	if (!valid) {
		return;
	}

	saving.value = true;

	try {
		const data: ISpaceCreateData = {
			name: formData.name,
			type: formData.type,
			description: formData.description || null,
			icon: formData.icon || null,
			displayOrder: formData.displayOrder,
		};

		let savedSpace: ISpace;

		if (props.space) {
			savedSpace = await spacesStore.edit({ id: props.space.id, data });
		} else {
			savedSpace = await spacesStore.add({ data });
		}

		emit('saved', savedSpace);
	} finally {
		saving.value = false;
	}
};

const onCancel = (): void => {
	emit('cancel');
};
</script>
