import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, shallowMount } from '@vue/test-utils';

import ViewSpacesWizard from './view-spaces-wizard.vue';

const mocks = vi.hoisted(() => ({
	nextStep: vi.fn(),
	prevStep: vi.fn(),
	createDraftSpacesFromProposals: vi.fn(),
	createSpacesFromProposals: vi.fn(),
	applyAssignments: vi.fn(),
	routerPush: vi.fn(),
	routerReplace: vi.fn(),
	currentStep: null as unknown as { value: number },
	assignableZones: null as unknown as { value: unknown[] },
}));

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('vue-meta', () => ({ useMeta: vi.fn() }));
vi.mock('vue-router', () => ({
	useRoute: () => ({ name: 'spaces-wizard', params: {} }),
	useRouter: () => ({ push: mocks.routerPush, replace: mocks.routerReplace, resolve: (to: unknown) => to }),
}));

vi.mock('../../../common', async () => {
	const { ref: vueRef } = await import('vue');

	return {
		AppBreadcrumbs: { name: 'AppBreadcrumbs', template: '<nav />' },
		IconWithChild: { name: 'IconWithChild', template: '<span />' },
		ViewHeader: { name: 'ViewHeader', props: ['title', 'subtitle', 'icon', 'left', 'onBack'], template: '<header />' },
		WizardShell: {
			name: 'WizardShell',
			props: ['steps', 'current', 'busy', 'nextLabel', 'navigable', 'stepWidth'],
			emits: ['next', 'back', 'cancel'],
			template: '<div><slot /><slot name="actions" /></div>',
		},
		useFlashMessage: () => ({ success: vi.fn(), error: vi.fn() }),
		useSizeClass: () => ({ isPhone: vueRef(false), isTabletPortrait: vueRef(false) }),
	};
});

vi.mock('../../../modules/spaces/composables', () => ({
	useSpaceCategories: () => ({ getCategoryOptions: () => [], getCategoryGroups: () => [], getCategoryTemplates: () => ({}) }),
}));

vi.mock('../composables', async () => {
	const { ref: vueRef, computed: vueComputed } = await import('vue');

	mocks.currentStep = vueRef(0);
	mocks.assignableZones = vueRef([]);

	return {
		useSpacesWizard: () => ({
			isLoading: vueRef(false),
			currentStep: mocks.currentStep,
			existingSpaces: vueRef([]),
			proposedSpaces: vueRef([]),
			customSpaces: vueRef([]),
			matchedSpaces: vueRef([]),
			availableSpaces: vueComputed(() => []),
			deviceAssignments: vueRef([]),
			displayAssignments: vueRef([]),
			zoneAssignments: vueRef([]),
			showAdvancedZones: vueRef(false),
			assignableZones: mocks.assignableZones,
			fetchProposedSpaces: vi.fn().mockResolvedValue(undefined),
			fetchDevices: vi.fn().mockResolvedValue([]),
			fetchDisplays: vi.fn().mockResolvedValue([]),
			fetchExistingSpaces: vi.fn().mockResolvedValue(undefined),
			createDraftSpacesFromProposals: mocks.createDraftSpacesFromProposals,
			createSpacesFromProposals: mocks.createSpacesFromProposals,
			setDeviceAssignment: vi.fn(),
			setDisplayAssignment: vi.fn(),
			setDeviceZones: vi.fn(),
			applyAssignments: mocks.applyAssignments,
			nextStep: mocks.nextStep,
			prevStep: mocks.prevStep,
			toggleProposedSpace: vi.fn(),
			toggleCustomSpace: vi.fn(),
			addManualSpace: vi.fn(),
			removeProposedSpace: vi.fn(),
			removeCustomSpace: vi.fn(),
			startEditingProposedName: vi.fn(),
			confirmProposedNameEdit: vi.fn(),
			discardProposedNameEdit: vi.fn(),
			startEditingCustomName: vi.fn(),
			confirmCustomNameEdit: vi.fn(),
			discardCustomNameEdit: vi.fn(),
			initializeDeviceAssignments: vi.fn(),
			initializeDisplayAssignments: vi.fn(),
			summary: vueComputed(() => ({
				spaceCount: 0,
				assignedDevices: 0,
				unassignedDevices: 0,
				assignedDisplays: 0,
				unassignedDisplays: 0,
				devicesBySpace: {},
				displaysBySpace: {},
			})),
		}),
	};
});

const shell = (wrapper: ReturnType<typeof shallowMount>) => wrapper.findComponent({ name: 'WizardShell' });

const mountWizard = () => shallowMount(ViewSpacesWizard, { global: { stubs: { WizardShell: false }, directives: { loading: {} } } });

describe('Home Control spaces wizard (template 9)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.currentStep.value = 0;
		mocks.assignableZones.value = [];
		mocks.createSpacesFromProposals.mockResolvedValue(undefined);
		mocks.applyAssignments.mockResolvedValue({ devicesAssigned: 0, displaysAssigned: 0, zonesAssigned: 0 });
	});

	it('runs in the wizard shell with its four steps, the current one from the flow', async () => {
		const wrapper = mountWizard();
		await flushPromises();

		expect((shell(wrapper).props('steps') as { id: string }[]).map((step) => step.id)).toEqual(['step-0', 'step-1', 'step-2', 'step-3']);
		expect(shell(wrapper).props('current')).toBe('step-0');
		expect(shell(wrapper).props('navigable')).toBe(false);
		expect(shell(wrapper).props('nextLabel')).toBeUndefined();
	});

	it('creates the draft spaces before leaving the first step', async () => {
		const wrapper = mountWizard();
		await flushPromises();

		shell(wrapper).vm.$emit('next');

		expect(mocks.createDraftSpacesFromProposals).toHaveBeenCalledOnce();
		expect(mocks.nextStep).toHaveBeenCalledOnce();
	});

	it('goes back a step', async () => {
		mocks.currentStep.value = 2;

		const wrapper = mountWizard();
		await flushPromises();

		shell(wrapper).vm.$emit('back');

		expect(mocks.prevStep).toHaveBeenCalledOnce();
	});

	it('finishes on the last step: creates the spaces, applies the assignments and returns to the list', async () => {
		mocks.currentStep.value = 3;

		const wrapper = mountWizard();
		await flushPromises();

		expect(shell(wrapper).props('nextLabel')).toBe('spacesModule.buttons.finish.title');

		shell(wrapper).vm.$emit('next');
		await flushPromises();

		expect(mocks.createSpacesFromProposals).toHaveBeenCalledOnce();
		expect(mocks.applyAssignments).toHaveBeenCalledOnce();
		expect(mocks.routerReplace).toHaveBeenCalledWith({ name: 'spaces_module-spaces' });
	});

	it('offers the zone toggle on the Devices step when there are zones to assign', async () => {
		mocks.currentStep.value = 2;
		mocks.assignableZones.value = [{ id: 'z1' }];

		const wrapper = mountWizard();
		await flushPromises();

		expect(wrapper.find('[data-test-id="spaces-wizard-advanced"]').exists()).toBe(true);
	});

	it('cancels back to the list', async () => {
		const wrapper = mountWizard();
		await flushPromises();

		shell(wrapper).vm.$emit('cancel');

		expect(mocks.routerReplace).toHaveBeenCalledWith({ name: 'spaces_module-spaces' });
	});
});
