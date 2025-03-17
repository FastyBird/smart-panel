<template>
	<el-form
		ref="userEditFormEl"
		:model="userEditForm"
		:rules="rules"
		label-position="top"
		status-icon
		class="px-5"
	>
		<el-form-item
			:label="t('usersModule.fields.username.title')"
			:prop="['username']"
		>
			<el-input
				v-model="userEditForm.username"
				name="username"
				readonly
				disabled
			>
				<template #append>
					<el-button
						type="primary"
						class="px-3!"
						@click="onChangeUsername"
					>
						<template #icon>
							<icon icon="mdi:pencil" />
						</template>
					</el-button>
				</template>
			</el-input>
		</el-form-item>

		<el-form-item
			:label="t('usersModule.fields.password.title')"
			:prop="['password']"
		>
			<el-input
				v-model="userEditForm.password"
				name="password"
				type="password"
				readonly
				disabled
				show-password
			>
				<template #append>
					<el-button
						type="primary"
						class="px-3!"
						@click="onChangePassword"
					>
						<template #icon>
							<icon icon="mdi:pencil" />
						</template>
					</el-button>
				</template>
			</el-input>
		</el-form-item>

		<el-divider />

		<el-form-item
			:label="t('usersModule.fields.email.title')"
			:prop="['email']"
		>
			<el-input
				v-model="userEditForm.email"
				:placeholder="t('usersModule.fields.email.placeholder')"
				name="email"
			/>
		</el-form-item>

		<el-form-item
			:label="t('usersModule.fields.firstName.title')"
			:prop="['firstName']"
		>
			<el-input
				v-model="userEditForm.firstName"
				:placeholder="t('usersModule.fields.firstName.placeholder')"
				name="firstName"
			/>
		</el-form-item>

		<el-form-item
			:label="t('usersModule.fields.lastName.title')"
			:prop="['lastName']"
		>
			<el-input
				v-model="userEditForm.lastName"
				:placeholder="t('usersModule.fields.lastName.placeholder')"
				name="lastName"
			/>
		</el-form-item>

		<el-divider />

		<el-form-item
			:label="t('usersModule.fields.role.label')"
			:prop="['role']"
		>
			<el-select
				v-model="userEditForm.role"
				:placeholder="t('usersModule.fields.role.placeholder')"
				name="role"
			>
				<el-option
					v-for="item in roleOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>
	</el-form>

	<el-dialog
		v-model="usernameFormVisible"
		:title="t('usersModule.headings.changeUsername')"
		width="500"
	>
		<username-edit-form
			v-model:remote-form-submit="remoteUsernameFormSubmit"
			v-model:remote-form-result="remoteUsernameFormResult"
			v-model:remote-form-reset="remoteUsernameFormReset"
			:user="props.user"
			class="mt-4"
		/>
		<template #footer>
			<div class="dialog-footer">
				<el-button
					link
					@click="onCloseUsername"
				>
					{{ t('usersModule.buttons.cancel.title') }}
				</el-button>
				<el-button
					type="primary"
					@click="onSubmitUsername"
				>
					{{ t('usersModule.buttons.change.title') }}
				</el-button>
			</div>
		</template>
	</el-dialog>

	<el-dialog
		v-model="passwordFormVisible"
		:title="t('usersModule.headings.changePassword')"
		width="500"
	>
		<password-edit-form
			v-model:remote-form-submit="remotePasswordFormSubmit"
			v-model:remote-form-result="remotePasswordFormResult"
			v-model:remote-form-reset="remotePasswordFormReset"
			:user="props.user"
			class="mt-4"
		/>
		<template #footer>
			<div class="dialog-footer">
				<el-button
					link
					@click="onClosePassword"
				>
					{{ t('usersModule.buttons.cancel.title') }}
				</el-button>
				<el-button
					type="primary"
					@click="onSubmitPassword"
				>
					{{ t('usersModule.buttons.change.title') }}
				</el-button>
			</div>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDialog, ElDivider, ElForm, ElFormItem, ElInput, ElOption, ElSelect, type FormInstance, type FormRules } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useUserEditForm } from '../composables';
import { FormResult, type FormResultType, UserRole } from '../users.constants';

import PasswordEditForm from './password-edit-form.vue';
import type { IUserEditFormFields, IUserEditFormProps } from './user-edit-form.types';
import UsernameEditForm from './username-edit-form.vue';

defineOptions({
	name: 'UserEditForm',
});

const props = withDefaults(defineProps<IUserEditFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formUpdated: boolean): void;
}>();

const { t } = useI18n();

const { submit, formResult } = useUserEditForm(props.user);

const userEditFormEl = ref<FormInstance | undefined>(undefined);

const usernameFormVisible = ref(false);

const remoteUsernameFormSubmit = ref<boolean>(false);
const remoteUsernameFormResult = ref<FormResultType>(FormResult.NONE);
const remoteUsernameFormReset = ref<boolean>(false);

const passwordFormVisible = ref(false);

const remotePasswordFormSubmit = ref<boolean>(false);
const remotePasswordFormResult = ref<FormResultType>(FormResult.NONE);
const remotePasswordFormReset = ref<boolean>(false);

const rules = reactive<FormRules<IUserEditFormFields>>({
	email: [{ type: 'email', message: t('usersModule.fields.email.validation.email'), trigger: 'change' }],
});

const userEditForm = reactive<IUserEditFormFields & { username: string; password: string }>({
	username: props.user.username,
	password: 'secretpassword',
	email: props.user.email,
	firstName: props.user.firstName,
	lastName: props.user.lastName,
	role: props.user.role,
});

const formChanges = computed<boolean>((): boolean => {
	if (userEditForm.email !== props.user.email) {
		return true;
	} else if (userEditForm.firstName !== props.user.firstName) {
		return true;
	} else if (userEditForm.lastName !== props.user.lastName) {
		return true;
	} else if (userEditForm.role !== props.user.role) {
		return true;
	}

	return false;
});

const roleOptions: { value: UserRole; label: string }[] = [
	{
		value: UserRole.USER,
		label: t('usersModule.fields.role.options.user'),
	},
	{
		value: UserRole.ADMIN,
		label: t('usersModule.fields.role.options.admin'),
	},
	{
		value: UserRole.OWNER,
		label: t('usersModule.fields.role.options.owner'),
	},
];

const onChangePassword = (): void => {
	passwordFormVisible.value = true;
};

const onSubmitPassword = (): void => {
	remotePasswordFormSubmit.value = true;
};

const onClosePassword = (): void => {
	remotePasswordFormReset.value = true;
	passwordFormVisible.value = false;
};

const onChangeUsername = (): void => {
	usernameFormVisible.value = true;
};

const onSubmitUsername = (): void => {
	remoteUsernameFormSubmit.value = true;
};

const onCloseUsername = (): void => {
	remoteUsernameFormReset.value = true;
	usernameFormVisible.value = false;
};

watch(
	(): FormResultType => formResult.value,
	async (val: FormResultType): Promise<void> => {
		emit('update:remote-form-result', val);
	}
);

watch(
	(): boolean => props.remoteFormSubmit,
	async (val: boolean): Promise<void> => {
		if (val) {
			emit('update:remote-form-submit', false);

			userEditFormEl.value!.clearValidate();

			userEditFormEl.value!.validate(async (valid: boolean): Promise<void> => {
				if (!valid) {
					return;
				}

				await submit({
					email: userEditForm.email,
					firstName: userEditForm.firstName,
					lastName: userEditForm.lastName,
					role: userEditForm.role,
				});
			});
		}
	}
);

watch(
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		emit('update:remote-form-reset', false);

		if (val) {
			if (!userEditFormEl.value) return;

			userEditFormEl.value.resetFields();
		}
	}
);

watch(
	(): boolean => formChanges.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);

watch(
	(): FormResultType => remotePasswordFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			passwordFormVisible.value = false;
		}
	}
);

watch(
	(): FormResultType => remoteUsernameFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			usernameFormVisible.value = false;

			userEditForm.username = props.user.username;
		}
	}
);
</script>
