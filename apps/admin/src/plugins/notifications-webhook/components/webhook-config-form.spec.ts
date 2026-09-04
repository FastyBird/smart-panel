import { type Reactive, nextTick, reactive, ref } from 'vue';

import { ElForm, type FormRules } from 'element-plus';
import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { FormResult } from '../../../modules/config';
import type { IConfigPlugin } from '../../../modules/config/store/config-plugins.store.types';
import { NOTIFICATIONS_WEBHOOK_PLUGIN_NAME } from '../notifications-webhook.constants';
import type { IWebhookConfigEditForm } from '../schemas/config.types';

import WebhookConfigForm from './webhook-config-form.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

let mockModel: Reactive<IWebhookConfigEditForm>;

vi.mock('../../../modules/config', async () => {
	const actual = await vi.importActual<typeof import('../../../modules/config')>('../../../modules/config');

	return {
		...actual,
		useConfigPluginEditForm: () => ({
			formEl: ref(undefined),
			model: mockModel,
			formChanged: ref(false),
			submit: vi.fn(),
			formResult: ref(actual.FormResult.NONE),
		}),
	};
});

const buildModel = (overrides: Partial<IWebhookConfigEditForm> = {}): Reactive<IWebhookConfigEditForm> =>
	reactive({
		type: NOTIFICATIONS_WEBHOOK_PLUGIN_NAME,
		enabled: true,
		url: undefined,
		urlConfigured: false,
		headers: undefined,
		headersConfigured: false,
		minSeverity: 'warning',
		...overrides,
	}) as Reactive<IWebhookConfigEditForm>;

const factory = () =>
	mount(WebhookConfigForm, {
		props: {
			config: { type: NOTIFICATIONS_WEBHOOK_PLUGIN_NAME } as unknown as IConfigPlugin,
			remoteFormResult: FormResult.NONE,
		},
	});

type Callback = (error?: string | Error) => void;
type Validator = (rule: unknown, value: unknown, callback: Callback) => void;

/**
 * Pulls the real `headers` field validator out of the mounted form's `rules` prop and calls it
 * directly, bypassing `ElForm`/`async-validator`'s own async plumbing entirely - this is the exact
 * function the component wires up, just exercised without going through a dependency chain that
 * (independent of anything under test here) does not settle its rejection reliably under Vitest's
 * SSR module loading.
 */
const getHeadersValidator = (wrapper: ReturnType<typeof factory>): Validator => {
	const rules = wrapper.findComponent(ElForm).props('rules') as FormRules<IWebhookConfigEditForm>;
	const rule = rules.headers;
	const first = Array.isArray(rule) ? rule[0] : rule;

	if (!first || typeof first.validator !== 'function') {
		throw new Error('headers rule validator not found');
	}

	return first.validator as Validator;
};

const runValidator = (validator: Validator, value: unknown): Promise<void> =>
	new Promise<void>((resolve, reject) => {
		validator({}, value, (error) => (error ? reject(error instanceof Error ? error : new Error(String(error))) : resolve()));
	});

describe('WebhookConfigForm', () => {
	// Retained headers never travel through the form as a value - `headersConfigured` is the only
	// signal that the backend still holds some and will merge them into the http: URL being saved.
	it('rejects switching to an http URL while stored headers are retained', async () => {
		mockModel = buildModel({
			url: 'http://n8n.local/webhook/panel',
			headersConfigured: true,
			headers: undefined,
		});

		const wrapper = factory();

		await nextTick();

		const validator = getHeadersValidator(wrapper);

		await expect(runValidator(validator, mockModel.headers)).rejects.toThrow('notificationsWebhookPlugin.fields.config.headers.requiresHttps');
	});

	// The secret input's explicit-removal gesture sends `null`, which is the one signal that there
	// is nothing left for the backend to merge - so http: has to stay available in that case.
	it('allows an http URL once retained headers are explicitly removed', async () => {
		mockModel = buildModel({
			url: 'http://n8n.local/webhook/panel',
			headersConfigured: true,
			headers: null,
		});

		const wrapper = factory();

		await nextTick();

		const validator = getHeadersValidator(wrapper);

		await expect(runValidator(validator, mockModel.headers)).resolves.toBeUndefined();
	});

	it('allows an http URL when no headers were ever configured', async () => {
		mockModel = buildModel({
			url: 'http://n8n.local/webhook/panel',
			headersConfigured: false,
			headers: undefined,
		});

		const wrapper = factory();

		await nextTick();

		const validator = getHeadersValidator(wrapper);

		await expect(runValidator(validator, mockModel.headers)).resolves.toBeUndefined();
	});

	it('still rejects a freshly typed header alongside an http URL', async () => {
		mockModel = buildModel({
			url: 'http://n8n.local/webhook/panel',
			headersConfigured: false,
			headers: undefined,
		});

		const wrapper = factory();

		await nextTick();

		const validator = getHeadersValidator(wrapper);

		await expect(runValidator(validator, '{"Authorization":"Bearer token"}')).rejects.toThrow(
			'notificationsWebhookPlugin.fields.config.headers.requiresHttps'
		);
	});
});
