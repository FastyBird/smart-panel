import { ModbusRegisterType } from '../devices-modbus.constants';

import { ReadBlock, ReadLimits, ReadPoint, planReadBlocks, sliceForPoint, splitBlock } from './read-planner';

const limits: ReadLimits = { maxRegisters: 125, maxBits: 2000, maxGap: 0 };

const point = (
	address: number,
	span = 1,
	registerType: ModbusRegisterType = ModbusRegisterType.HOLDING_REGISTER,
	key = `${registerType}-${address}-${span}`,
): ReadPoint => ({ key, registerType, address, span });

describe('read-planner', () => {
	it('groups contiguous registers', () => {
		const points = Array.from({ length: 8 }, (_, i) => point(1 + i));

		const blocks = planReadBlocks(points, limits);

		expect(blocks).toHaveLength(1);
		expect(blocks[0]).toMatchObject({ address: 1, count: 8 });
		expect(blocks[0].points).toHaveLength(8);
	});

	it('separates register types', () => {
		const blocks = planReadBlocks([point(4), point(4, 1, ModbusRegisterType.INPUT_REGISTER)], limits);

		expect(blocks).toHaveLength(2);
		expect(blocks.map((b) => b.registerType)).toEqual([
			ModbusRegisterType.INPUT_REGISTER,
			ModbusRegisterType.HOLDING_REGISTER,
		]);
	});

	it('breaks on gaps when maxGap is 0', () => {
		const points = [point(1), point(3)];

		expect(planReadBlocks(points, limits)).toHaveLength(2);

		const merged = planReadBlocks(points, { ...limits, maxGap: 1 });

		expect(merged).toHaveLength(1);
		expect(merged[0]).toMatchObject({ address: 1, count: 3 });
	});

	it('respects maxRegisters', () => {
		const points = Array.from({ length: 130 }, (_, i) => point(i));

		const blocks = planReadBlocks(points, limits);

		expect(blocks.map((b) => [b.address, b.count])).toEqual([
			[0, 125],
			[125, 5],
		]);
	});

	it('respects maxBits for bit types', () => {
		const points = Array.from({ length: 5 }, (_, i) => point(i, 1, ModbusRegisterType.COIL));

		const blocks = planReadBlocks(points, { ...limits, maxBits: 4 });

		expect(blocks.map((b) => [b.address, b.count])).toEqual([
			[0, 4],
			[4, 1],
		]);
	});

	it('counts 32-bit spans', () => {
		const blocks = planReadBlocks([point(10, 2), point(12, 1)], limits);

		expect(blocks).toHaveLength(1);
		expect(blocks[0]).toMatchObject({ address: 10, count: 3 });
	});

	it('shares a register between bit points', () => {
		const points = [
			...Array.from({ length: 16 }, (_, i) => point(4, 1, ModbusRegisterType.HOLDING_REGISTER, `a${i}`)),
			...Array.from({ length: 16 }, (_, i) => point(5, 1, ModbusRegisterType.HOLDING_REGISTER, `b${i}`)),
		];

		const blocks = planReadBlocks(points, limits);

		expect(blocks).toHaveLength(1);
		expect(blocks[0]).toMatchObject({ address: 4, count: 2 });
		expect(blocks[0].points).toHaveLength(32);
	});

	it('merges overlapping points', () => {
		const blocks = planReadBlocks([point(10, 2), point(11, 1)], limits);

		expect(blocks).toHaveLength(1);
		expect(blocks[0]).toMatchObject({ address: 10, count: 2 });
	});

	it("sliceForPoint returns the point's own values", () => {
		const block: ReadBlock = {
			registerType: ModbusRegisterType.HOLDING_REGISTER,
			address: 4,
			count: 2,
			points: [point(4), point(5)],
		};

		expect(sliceForPoint(block, [0x0001, 0x8000], point(5))).toEqual([0x8000]);
	});

	it('splitBlock yields single-point blocks', () => {
		const block: ReadBlock = {
			registerType: ModbusRegisterType.HOLDING_REGISTER,
			address: 1,
			count: 2,
			points: [
				point(1),
				point(2, 1, ModbusRegisterType.HOLDING_REGISTER, 'x'),
				point(2, 1, ModbusRegisterType.HOLDING_REGISTER, 'y'),
			],
		};

		const blocks = splitBlock(block);

		expect(blocks.map((b) => [b.address, b.count, b.points.length])).toEqual([
			[1, 1, 1],
			[2, 1, 2],
		]);
	});
});
