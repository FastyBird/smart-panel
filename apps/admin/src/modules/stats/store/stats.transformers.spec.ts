import { describe, expect, it, vi } from 'vitest';

import { StatsValidationException } from '../stats.exceptions';

import type { IStatsRes } from './stats.store.types';
import { transformStatsResponse } from './stats.transformers';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		logger: {
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
		},
	};
});

const validStatsResponse: IStatsRes = {
	'api-module': {
		req_per_min: {
			value: 0,
			last_updated: '2025-11-02T09:13:40.439Z',
		},
		error_rate_5m: {
			value: 0,
			last_updated: '2025-11-02T09:13:40.439Z',
		},
		p95_ms_5m: {
			value: 0,
			last_updated: '2025-11-02T09:13:40.439Z',
		},
	},
};

describe('Stats Info Transformers', (): void => {
	describe('transformStatsResponse', (): void => {
		it('should transform a valid stats response', (): void => {
			const result = transformStatsResponse(validStatsResponse);

			expect(result).toEqual({
				'api-module': {
					reqPerMin: {
						value: 0,
						lastUpdated: new Date('2025-11-02T09:13:40.439Z'),
					},
					errorRate5m: {
						value: 0,
						lastUpdated: new Date('2025-11-02T09:13:40.439Z'),
					},
					p95Ms5m: {
						value: 0,
						lastUpdated: new Date('2025-11-02T09:13:40.439Z'),
					},
				},
			});
		});

		it('should throw an error for an invalid stats response', (): void => {
			expect(() =>
				transformStatsResponse({ 'api-module': { ...validStatsResponse['api-module'], req_per_min: 'not-a-number' } } as unknown as IStatsRes)
			).toThrow(StatsValidationException);
		});
	});
});
