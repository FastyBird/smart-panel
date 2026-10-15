import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { IntentTargetStatus } from '../../../modules/intents/intents.constants';
import { CoversIntentType } from '../spaces-home-control.constants';

import { CoverGroupIntentPort } from './cover-group-intent.port';
import { CoverDevice } from './space-covers-state.service';

const cover = (id: string, group = true) =>
	({
		device: { id, type: group ? 'virtual' : 'physical', mode: group ? 'actuator_group' : undefined },
		coverChannel: { id },
		commandProperty: { id: `${id}-command`, category: PropertyCategory.COMMAND },
		positionProperty: { id: `${id}-position`, unit: '%', format: [0, 100] },
		role: null,
	}) as unknown as CoverDevice;
const record = () => ({ id: 'room-intent', expiresAt: new Date(Date.now() + 30_000) });
describe('covers room port to core composites', () => {
	const dispatchBatch = jest.fn();
	const plan = jest.fn();
	const entry = { revision: 'entry' };
	const captureCommandEntry = jest.fn(() => entry),
		releaseCommandEntry = jest.fn();
	const port = new CoverGroupIntentPort(
		{ captureCommandEntry, releaseCommandEntry } as never,
		{ dispatchBatch } as never,
		{ plan } as never,
	);
	const group = cover('group');
	const current = jest.fn(() => true);
	beforeEach(() => {
		jest.clearAllMocks();
		plan.mockImplementation((targets: { channel: { id: string } }[]) =>
			Promise.resolve({
				targets: targets.filter((item) => item.channel.id !== 'member-a'),
				excludedRawChannels: ['member-a'],
				coverage: new Map([['group', { leaves: ['member-a', 'member-b'] }]]),
				isCurrent: current,
			}),
		);
	});
	it.each([CoversIntentType.OPEN, CoversIntentType.CLOSE, CoversIntentType.STOP])(
		'dispatches %s as native COMMAND under the original entry/deadline and preserves partial children',
		async (type) => {
			const composite = {
				status: 'partial',
				children: [
					{ memberIdentity: 'member-a', status: 'confirmed' },
					{ memberIdentity: 'member-b', status: 'unavailable', reason: 'tag_unavailable' },
				],
			};
			dispatchBatch.mockResolvedValue({ success: false, composite });
			const intent = record();
			const snapshot = port.capture();
			const result = await port.execute([group, cover('member-a', false)], { type }, intent as never, snapshot);
			port.release(snapshot);
			expect(plan).toHaveBeenCalledWith(expect.any(Array), 'covers');
			expect(dispatchBatch).toHaveBeenCalledWith(
				[expect.objectContaining({ property: group.commandProperty, value: type })],
				expect.objectContaining({
					intentId: intent.id,
					commandEntry: entry,
					deadlineAt: intent.expiresAt.getTime() - 100,
					isRequestCurrent: current,
				}),
			);
			expect(result.result.newPosition).toBeNull();
			expect(result.result.composites).toEqual([composite]);
			expect(result.results).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ status: IntentTargetStatus.SKIPPED, error: 'represented_by_cover_group' }),
					expect.objectContaining({ status: IntentTargetStatus.FAILED, error: 'confirmed; tag_unavailable' }),
				]),
			);
			expect(releaseCommandEntry).toHaveBeenCalledWith(entry);
		},
	);
	it('leaves ordinary-only commands on the existing path', async () => {
		expect(await port.execute([cover('raw', false)], { type: CoversIntentType.OPEN }, record() as never)).toBeNull();
		expect(dispatchBatch).not.toHaveBeenCalled();
	});
	it('refuses unsupported relative conversion and overlapping membership without dispatch', async () => {
		const result = await port.execute([group], { type: CoversIntentType.POSITION_DELTA }, record() as never);
		expect(result.result.failedDevices).toBe(1);
		expect(dispatchBatch).not.toHaveBeenCalled();
		plan.mockRejectedValue(new Error('covers_contribution_conflict'));
		const conflict = await port.execute([group], { type: CoversIntentType.OPEN }, record() as never);
		expect(conflict.results[0].error).toBe('covers_contribution_conflict');
		expect(dispatchBatch).not.toHaveBeenCalled();
	});
	it('does not turn an exception after send into confirmation or retry it', async () => {
		dispatchBatch.mockRejectedValue(new Error('uncertain'));
		const result = await port.execute([group], { type: CoversIntentType.STOP }, record() as never);
		expect(result.result.success).toBe(false);
		expect(result.results[0].error).toBe('uncertain');
		expect(dispatchBatch).toHaveBeenCalledTimes(1);
	});
});
