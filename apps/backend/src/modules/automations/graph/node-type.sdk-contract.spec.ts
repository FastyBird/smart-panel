/**
 * The extension SDK publishes plain mirrors of the node type contract (`packages/extension-sdk/src/
 * automation.types.ts`), so an extension built outside the backend can type its cards without importing
 * the backend. This suite keeps the two from drifting apart: every `same<Sdk, Backend>(true)` below fails to
 * compile - and so fails the suite and the backend type check - as soon as a field is added, removed,
 * renamed, made optional or changes its type on either side.
 *
 * The comparison is strict type identity, not assignability both ways: TypeScript checks the parameters of
 * a method bivariantly, so a mirror whose `evaluate(config)` took a narrower configuration would still be
 * assignable in both directions. Identity rejects that (see the last case of the suite).
 */
import * as Sdk from '@fastybird/smart-panel-extension-sdk';

import { AutomationNodeTypeRegistryService } from '../services/node-type-registry.service';

import * as Backend from './node-type';

type Assignable<A, B> = [A] extends [B] ? true : false;

/** Whether the two are the very same type; invariant in every member, method parameters included */
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const same = <A, B>(proof: Same<A, B>): boolean => proof;

const assignable = <A, B>(proof: Assignable<A, B>): boolean => proof;

/** A configuration type of a card, to compare the generic types with something other than their default */
interface SampleConfig {
	signal: string;
	seconds?: number;
}

describe('extension SDK automation contract', () => {
	it('mirrors the shared shapes of the backend contract', () => {
		expect(same<Sdk.AutomationNodeKind, Backend.AutomationNodeKind>(true)).toBe(true);
		expect(same<Sdk.AutomationNodePorts, Backend.AutomationNodePorts>(true)).toBe(true);
		expect(same<Sdk.AutomationNodeReferenceKind, Backend.AutomationNodeReferenceKind>(true)).toBe(true);
		expect(same<Sdk.AutomationNodeReference, Backend.AutomationNodeReference>(true)).toBe(true);
		expect(same<Sdk.AutomationNodeConfig, Backend.AutomationNodeConfig>(true)).toBe(true);
		expect(same<Sdk.AutomationNodeTypeOwner, Backend.AutomationNodeTypeOwner>(true)).toBe(true);
		expect(same<Sdk.AutomationNodeConfigProblem, Backend.AutomationNodeConfigProblem>(true)).toBe(true);
		expect(same<Sdk.AutomationNodeConfigValidator, Backend.AutomationNodeConfigValidator>(true)).toBe(true);
	});

	it('mirrors what the engine hands to a card and what a card answers', () => {
		expect(same<Sdk.AutomationTriggerData, Backend.AutomationTriggerData>(true)).toBe(true);
		expect(same<Sdk.AutomationRunTrigger, Backend.AutomationRunTrigger>(true)).toBe(true);
		expect(same<Sdk.AutomationRunContext, Backend.AutomationRunContext>(true)).toBe(true);
		expect(same<Sdk.AutomationTriggerContext, Backend.AutomationTriggerContext>(true)).toBe(true);
		expect(same<Sdk.AutomationConditionResult, Backend.AutomationConditionResult>(true)).toBe(true);
		expect(same<Sdk.AutomationActionResult, Backend.AutomationActionResult>(true)).toBe(true);
		expect(same<Sdk.AutomationActionCommand, Backend.AutomationActionCommand>(true)).toBe(true);
	});

	it('mirrors the card definitions of every kind an extension can add', () => {
		expect(same<Sdk.AutomationNodeTypeBase, Backend.AutomationNodeTypeBase>(true)).toBe(true);
		expect(same<Sdk.AutomationNodeTypeBase<SampleConfig>, Backend.AutomationNodeTypeBase<SampleConfig>>(true)).toBe(
			true,
		);
		expect(same<Sdk.AutomationTriggerNodeType, Backend.AutomationTriggerNodeType>(true)).toBe(true);
		expect(
			same<Sdk.AutomationTriggerNodeType<SampleConfig>, Backend.AutomationTriggerNodeType<SampleConfig>>(true),
		).toBe(true);
		expect(same<Sdk.AutomationConditionNodeType, Backend.AutomationConditionNodeType>(true)).toBe(true);
		expect(
			same<Sdk.AutomationConditionNodeType<SampleConfig>, Backend.AutomationConditionNodeType<SampleConfig>>(true),
		).toBe(true);
		expect(same<Sdk.AutomationActionNodeType, Backend.AutomationActionNodeType>(true)).toBe(true);
		expect(same<Sdk.AutomationActionNodeType<SampleConfig>, Backend.AutomationActionNodeType<SampleConfig>>(true)).toBe(
			true,
		);
	});

	it('lets the backend registry stand in for the registrar an extension types against', () => {
		expect(assignable<AutomationNodeTypeRegistryService, Sdk.AutomationNodeTypeRegistrar>(true)).toBe(true);
		expect(
			assignable<Sdk.AutomationExtensionNodeType<SampleConfig>, Backend.AutomationNodeType<SampleConfig>>(true),
		).toBe(true);
	});

	it('publishes the same limits and default ports as the backend', () => {
		expect(Sdk.AUTOMATION_NODE_DEFAULT_PORTS).toEqual(Backend.AUTOMATION_NODE_DEFAULT_PORTS);
		expect([...Sdk.AUTOMATION_EXTENSION_NODE_KINDS]).toEqual(
			Backend.AUTOMATION_NODE_KINDS.filter((kind) => kind !== 'flow'),
		);
		expect(Sdk.AUTOMATION_NODE_DEFAULT_TIMEOUT_SECONDS).toBe(Backend.AUTOMATION_NODE_DEFAULT_TIMEOUT_SECONDS);
		expect(Sdk.AUTOMATION_NODE_MAX_TIMEOUT_SECONDS).toBe(Backend.AUTOMATION_NODE_MAX_TIMEOUT_SECONDS);
		expect(Sdk.AUTOMATION_NODE_TYPE_MAX_LENGTH).toBe(Backend.AUTOMATION_NODE_TYPE_MAX_LENGTH);
	});

	it.each([
		'acme.doorbell.rang',
		'example-extension.signal.received',
		'a_b-c.d',
		'x1',
		'',
		'Upper.case',
		'trailing.',
		'.leading',
		'double..dot',
		'space here',
		'a'.repeat(Backend.AUTOMATION_NODE_TYPE_MAX_LENGTH),
		'a'.repeat(Backend.AUTOMATION_NODE_TYPE_MAX_LENGTH + 1),
	])('agrees with the registry on whether %j is a card type identifier', (type) => {
		const accepted = (() => {
			try {
				Backend.normalizeAutomationNodeType({
					type,
					kind: 'action',
					name: 'Card',
					description: '',
					validateConfig: () => [],
				});

				return true;
			} catch {
				return false;
			}
		})();

		expect(Sdk.isAutomationNodeTypeId(type)).toBe(accepted);
	});

	it('rejects a mirror that narrows what a card handler accepts', () => {
		/** The SDK condition with its `evaluate` restated, so both sides of each comparison share one representation */
		type WithEvaluate<TEvaluateConfig> = Omit<Sdk.AutomationConditionNodeType<SampleConfig>, 'evaluate'> & {
			evaluate(config: TEvaluateConfig, context: Sdk.AutomationRunContext): Promise<Sdk.AutomationConditionResult>;
		};

		type Unchanged = WithEvaluate<SampleConfig>;
		/** As it would be if its `evaluate` took a narrower configuration than the backend's */
		type Narrowed = WithEvaluate<SampleConfig & { extra: string }>;

		// Control: restating the same signature is the same type, so a difference below comes from the parameter alone
		expect(same<Unchanged, WithEvaluate<SampleConfig>>(true)).toBe(true);

		// Assignable both ways, because method parameters are compared bivariantly ...
		expect(assignable<Narrowed, Unchanged>(true)).toBe(true);
		expect(assignable<Unchanged, Narrowed>(true)).toBe(true);

		// ... but not the same type, which is what the checks above ask for
		const identical: Same<Narrowed, Unchanged> = false;
		// @ts-expect-error A narrowed handler parameter is drift: claiming the types are the same does not compile
		const claimed: Same<Narrowed, Unchanged> = true;

		expect([identical, claimed]).toEqual([false, true]);
	});
});
