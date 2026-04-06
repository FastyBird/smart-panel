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
			<el-alert
				type="info"
				:title="t('onboardingModule.account.description')"
				:closable="false"
				show-icon
				class="mb-6!"
			/>

			<el-form
				ref="formEl"
				:model="accountData"
				:rules="rules"
				label-position="top"
				status-icon
			>
				<div class="flex flex-row flex-nowrap gap-5">
					<el-form-item
						:label="t('onboardingModule.account.fields.firstName')"
						prop="firstName"
						class="flex-1"
					>
						<el-input
							v-model="accountData.firstName"
							:placeholder="t('onboardingModule.account.placeholders.firstName')"
							name="firstName"
							@keyup.enter="lastNameInputEl?.focus()"
						/>
					</el-form-item>

					<el-form-item
						:label="t('onboardingModule.account.fields.lastName')"
						prop="lastName"
						class="flex-1"
					>
						<el-input
							ref="lastNameInputEl"
							v-model="accountData.lastName"
							:placeholder="t('onboardingModule.account.placeholders.lastName')"
							name="lastName"
							@keyup.enter="emailInputEl?.focus()"
						/>
					</el-form-item>
				</div>

				<el-form-item
					:label="t('onboardingModule.account.fields.email')"
					prop="email"
				>
					<el-input
						ref="emailInputEl"
						v-model="accountData.email"
						:placeholder="t('onboardingModule.account.placeholders.email')"
						name="email"
						type="email"
						@keyup.enter="usernameInputEl?.focus()"
					/>
				</el-form-item>

				<el-form-item
					:label="t('onboardingModule.account.fields.username')"
					prop="username"
				>
					<el-input
						ref="usernameInputEl"
						v-model="accountData.username"
						:placeholder="t('onboardingModule.account.placeholders.username')"
						name="username"
						@keyup.enter="passwordInputEl?.focus()"
					/>
				</el-form-item>

				<el-form-item
					:label="t('onboardingModule.account.fields.password')"
					prop="password"
				>
					<el-input
						ref="passwordInputEl"
						v-model="accountData.password"
						:placeholder="t('onboardingModule.account.placeholders.password')"
						name="password"
						type="password"
						show-password
						@keyup.enter="confirmPasswordInputEl?.focus()"
					/>
				</el-form-item>

				<el-form-item
					:label="t('onboardingModule.account.fields.confirmPassword')"
					prop="confirmPassword"
				>
					<el-input
						ref="confirmPasswordInputEl"
						v-model="accountData.confirmPassword"
						:placeholder="t('onboardingModule.account.placeholders.confirmPassword')"
						name="confirmPassword"
						type="password"
						show-password
						@keyup.enter="emit('submit')"
					/>
				</el-form-item>
			</el-form>
		</template>
	</div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { InternalRuleItem } from 'async-validator';
import { ElAlert, ElForm, ElFormItem, ElInput, type FormInstance, type FormRules, type InputInstance } from 'element-plus';

import { type IAccountData, useAppOnboarding } from '../composables/composables';

defineOptions({
	name: 'StepAccount',
});

const emit = defineEmits<{
	(e: 'submit'): void;
}>();

const { t } = useI18n();

const { accountData, accountCreated } = useAppOnboarding();

const formEl = ref<FormInstance | undefined>(undefined);
const lastNameInputEl = ref<InputInstance | undefined>(undefined);
const emailInputEl = ref<InputInstance | undefined>(undefined);
const usernameInputEl = ref<InputInstance | undefined>(undefined);
const passwordInputEl = ref<InputInstance | undefined>(undefined);
const confirmPasswordInputEl = ref<InputInstance | undefined>(undefined);

const rules = reactive<FormRules<IAccountData>>({
	email: [{ type: 'email', message: t('onboardingModule.account.validation.emailInvalid'), trigger: 'change' }],
	firstName: [{ required: true, message: t('onboardingModule.account.validation.firstNameRequired'), trigger: 'change' }],
	lastName: [{ required: true, message: t('onboardingModule.account.validation.lastNameRequired'), trigger: 'change' }],
	username: [{ required: true, message: t('onboardingModule.account.validation.usernameRequired'), trigger: 'change' }],
	password: [{ required: true, message: t('onboardingModule.account.validation.passwordRequired'), trigger: 'change' }],
	confirmPassword: [
		{
			validator: (_rule: InternalRuleItem, value: string, callback: (message?: Error) => void): void => {
				if (!value) {
					callback(new Error(t('onboardingModule.account.validation.confirmPasswordRequired')));
				} else if (value !== accountData.password) {
					callback(new Error(t('onboardingModule.account.validation.passwordMismatch')));
				} else {
					callback();
				}
			},
			trigger: 'change',
		},
	],
});

const validate = async (): Promise<boolean> => {
	if (!formEl.value) return false;

	try {
		await formEl.value.validate();
		return true;
	} catch {
		return false;
	}
};

defineExpose({ validate });
</script>
