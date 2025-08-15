import { createPinia, setActivePinia } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type Mock, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';

import { type IUseBackend, useBackend } from '../../../common';
import { SystemApiException } from '../system.exceptions';

import { useDisplaysProfiles } from './displays-profiles.store';

const displayId = uuid();
const displayUid = uuid();

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
	PATCH: vi.fn(),
	DELETE: vi.fn(),
};

vi.mock('../../../common', () => ({
	useBackend: vi.fn(() => ({
		client: backendClient,
	})),
	getErrorReason: vi.fn(),
}));

describe('Displays Profiles Store', (): void => {
	let displaysStore: ReturnType<typeof useDisplaysProfiles>;
	let backendMock: IUseBackend;

	beforeEach((): void => {
		setActivePinia(createPinia());

		backendMock = useBackend();

		displaysStore = useDisplaysProfiles();

		vi.clearAllMocks();
	});

	it('should fetch displays profiles successfully', async (): Promise<void> => {
		(backendMock.client.GET as Mock).mockResolvedValue({
			data: {
				data: [
					{
						id: displayId,
						uid: displayUid,
						screen_width: 1280,
						screen_height: 720,
						pixel_ratio: 2,
						unit_size: 120,
						rows: 6,
						cols: 4,
						primary: true,
						created_at: '2024-03-01T12:00:00Z',
						updated_at: '2024-03-02T12:00:00Z',
					},
				],
			},
		});

		await displaysStore.fetch();

		expect(displaysStore.findAll()).toHaveLength(1);
		expect(displaysStore.findById(displayId)?.screenWidth).toBe(1280);
		expect(displaysStore.firstLoadFinished()).toBe(true);
	});

	it('should throw error when fetching displays profiles fails', async (): Promise<void> => {
		(backendMock.client.GET as Mock).mockResolvedValue({ error: new Error('API error'), response: { status: 404 } });

		await expect(displaysStore.fetch()).rejects.toThrow(SystemApiException);
	});

	it('should add a display profile successfully', async (): Promise<void> => {
		(backendMock.client.POST as Mock).mockResolvedValue({
			data: {
				data: {
					id: displayId,
					uid: displayUid,
					screen_width: 1280,
					screen_height: 720,
					pixel_ratio: 2,
					unit_size: 120,
					rows: 6,
					cols: 4,
					primary: true,
					created_at: '2024-03-01T12:00:00Z',
					updated_at: '2024-03-02T12:00:00Z',
				},
			},
		});

		const display = await displaysStore.add({
			id: displayId,
			data: {
				uid: displayUid,
				screenWidth: 1280,
				screenHeight: 720,
				pixelRatio: 2,
				unitSize: 120,
				rows: 6,
				cols: 4,
				primary: true,
			},
		});

		expect(display.id).toBe(displayId);
		expect(displaysStore.findById(displayId)).toEqual(display);
	});

	it('should throw an error when adding a display profile fails', async (): Promise<void> => {
		(backendMock.client.POST as Mock).mockResolvedValue({ error: new Error('API error'), response: { status: 404 } });

		await expect(
			displaysStore.add({
				id: displayId,
				data: {
					uid: displayUid,
					screenWidth: 1280,
					screenHeight: 720,
					pixelRatio: 2,
					unitSize: 120,
					rows: 6,
					cols: 4,
					primary: true,
				},
			})
		).rejects.toThrow(SystemApiException);
	});

	it('should edit a display profile successfully', async (): Promise<void> => {
		displaysStore.data[displayId] = {
			id: displayId,
			uid: displayUid,
			screenWidth: 1280,
			screenHeight: 720,
			pixelRatio: 2,
			unitSize: 120,
			rows: 6,
			cols: 4,
			primary: true,
			createdAt: new Date(),
			updatedAt: null,
		};

		(backendMock.client.PATCH as Mock).mockResolvedValue({
			data: {
				data: {
					id: displayId,
					uid: displayUid,
					screen_width: 1280,
					screen_height: 720,
					pixel_ratio: 2,
					unit_size: 120,
					rows: 4,
					cols: 4,
					primary: true,
					created_at: '2024-03-01T12:00:00Z',
					updated_at: '2024-03-02T12:00:00Z',
				},
			},
		});

		const updatedDisplay = await displaysStore.edit({
			id: displayId,
			data: { rows: 4 },
		});

		expect(updatedDisplay.rows).toBe(4);
		expect(displaysStore.findById(displayId)?.uid).toBe(displayUid);
	});

	it('should throw an error when editing a display profile fails', async (): Promise<void> => {
		displaysStore.data[displayId] = {
			id: displayId,
			uid: displayUid,
			screenWidth: 1280,
			screenHeight: 720,
			pixelRatio: 2,
			unitSize: 120,
			rows: 6,
			cols: 4,
			primary: true,
			createdAt: new Date(),
			updatedAt: null,
		};

		(backendMock.client.PATCH as Mock).mockResolvedValue({ error: new Error('API error'), response: { status: 404 } });

		await expect(displaysStore.edit({ id: displayId, data: { rows: 6 } })).rejects.toThrow(SystemApiException);
	});

	it('should remove a display profile successfully', async (): Promise<void> => {
		displaysStore.data[displayId] = {
			id: displayId,
			uid: displayUid,
			screenWidth: 1280,
			screenHeight: 720,
			pixelRatio: 2,
			unitSize: 120,
			rows: 6,
			cols: 4,
			primary: true,
			createdAt: new Date(),
			updatedAt: null,
		};

		(backendMock.client.DELETE as Mock).mockResolvedValue({ response: { status: 204 } });

		const result = await displaysStore.remove({ id: displayId });

		expect(result).toBe(true);
		expect(displaysStore.findById(displayId)).toBe(null);
	});

	it('should throw an error when removing a display profile fails', async (): Promise<void> => {
		displaysStore.data[displayId] = {
			id: displayId,
			uid: displayUid,
			screenWidth: 1280,
			screenHeight: 720,
			pixelRatio: 2,
			unitSize: 120,
			rows: 6,
			cols: 4,
			primary: true,
			createdAt: new Date(),
			updatedAt: null,
		};

		(backendMock.client.DELETE as Mock).mockResolvedValue({ error: new Error('API error'), response: { status: 404 } });

		await expect(displaysStore.remove({ id: displayId })).rejects.toThrow(SystemApiException);
	});
});
