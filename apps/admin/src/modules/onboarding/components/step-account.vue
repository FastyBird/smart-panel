<template>
	<div class="py-4 px-4 max-w-lg mx-auto">
		<el-alert
			v-if="accountCreated"
			type="success"
			:title="t('onboardingModule.account.created')"
			:closable="false"
			show-icon
			class="mb-4!"
		/>

		<template v-else>
			<p class="text-gray-500 mb-6">
				{{ t('onboardingModule.account.description') }}
			</p>

			<el-form
				ref="formEl"
				:model="accountData"
				:rules="rules"
				label-position="top"
				status-icon
				@submit.prevent="onSubmit"
			>
				<div class="flex flex-row flex-nowrap gap-5">
					<el-form-item
						:label="t('onboardingModule.account.fields.firstName')"
						prop="firstName"
					>
						<el-input
							v-model="accountData.firstName"
							:placeholder="t('onboardingModule.account.placeholders.firstName')"
							name="firstName"
						/>
					</el-form-item>

					<el-form-item
						:label="t('onboardingModule.account.fields.lastName')"
						prop="lastName"
					>
						<el-input
							v-model="accountData.lastName"
							:placeholder="t('onboardingModule.account.placeholders.lastName')"
							name="lastName"
						/>
					</el-form-item>
				</div>

				<el-form-item
					:label="t('onboardingModule.account.fields.email')"
					prop="email"
				>
					<el-input
						v-model="accountData.email"
						:placeholder="t('onboardingModule.account.placeholders.email')"
						name="email"
						type="email"
					/>
				</el-form-item>

				<el-form-item
					:label="t('onboardingModule.account.fields.username')"
					prop="username"
				>
					<el-input
						v-model="accountData.username"
						:placeholder="t('onboardingModule.account.placeholders.username')"
						name="username"
					/>
				</el-form-item>

				<el-form-item
					:label="t('onboardingModule.account.fields.password')"
					prop="password"
				>
					<el-input
						v-model="accountData.password"
						:placeholder="t('onboardingModule.account.placeholders.password')"
						name="password"
						type="password"
						show-password
					/>
				</el-form-item>

				<el-button
					type="primary"
					size="large"
					class="block w-full mt-4!"
					:loading="isLoading"
					@click="onSubmit"
				>
					{{ t('onboardingModule.account.buttons.create') }}
				</el-button>
			</el-form>
		</template>
	</div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElForm, ElFormItem, ElInput, type FormInstance, type FormRules } from 'element-plus';

import type { IAccountData } from '../composables/composables';

defineOptions({
	name: 'StepAccount',
});

const props = defineProps<{
	accountData: IAccountData;
	accountCreated: boolean;
	isLoading: boolean;
}>();

const emit = defineEmits<{
	(e: 'create-account'): void;
}>();

const { t } = useI18n();

const formEl = ref<FormInstance | undefined>(undefined);

const rules = reactive<FormRules<IAccountData>>({
	email: [
		{ required: true, message: t('onboardingModule.account.validation.emailRequired'), trigger: 'change' },
		{ type: 'email', message: t('onboardingModule.account.validation.emailInvalid'), trigger: 'change' },
	],
	firstName: [{ required: true, message: t('onboardingModule.account.validation.firstNameRequired'), trigger: 'change' }],
	lastName: [{ required: true, message: t('onboardingModule.account.validation.lastNameRequired'), trigger: 'change' }],
	username: [{ required: true, message: t('onboardingModule.account.validation.usernameRequired'), trigger: 'change' }],
	password: [
		{ required: true, message: t('onboardingModule.account.validation.passwordRequired'), trigger: 'change' },
		{ min: 6, message: t('onboardingModule.account.validation.passwordMin'), trigger: 'change' },
	],
});

const onSubmit = async (): Promise<void> => {
	if (!formEl.value) return;

	await formEl.value.validate(async (valid: boolean): Promise<void> => {
		if (valid) {
			emit('create-account');
		}
	});
};
</script>
