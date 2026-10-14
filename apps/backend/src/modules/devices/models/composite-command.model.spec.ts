import { instanceToPlain } from 'class-transformer';

import { IntentRecord } from '../../intents/models/intent.model';
import { ActionExecutionResultModel } from '../../scenes/models/scenes.model';

import { CompositeCommandOutcomeModel } from './composite-command.model';

describe('composite command response contracts', () => {
	it('serializes nested scene and intent child identities in snake_case while retaining internal fields', () => {
		const composite: CompositeCommandOutcomeModel = {
			id: 'parent',
			status: 'partial',
			children: [
				{
					memberId: 'member',
					memberIdentity: 'original-channel',
					propertyId: null,
					propertyIdentity: 'deleted-property',
					status: 'unavailable',
				},
			],
		};
		const expected = {
			member_id: 'member',
			member_identity: 'original-channel',
			property_id: null,
			property_identity: 'deleted-property',
			status: 'unavailable',
		};
		const action = Object.assign(new ActionExecutionResultModel(), { composite });
		const intent = Object.assign(new IntentRecord(), { composites: [composite] });

		expect(instanceToPlain(action)).toEqual(
			expect.objectContaining({ composite: { id: 'parent', status: 'partial', children: [expected] } }),
		);
		expect(instanceToPlain(intent)).toEqual(
			expect.objectContaining({ composites: [{ id: 'parent', status: 'partial', children: [expected] }] }),
		);
		expect(composite.children[0].memberId).toBe('member');
		expect(composite.children[0].propertyIdentity).toBe('deleted-property');
	});
});
