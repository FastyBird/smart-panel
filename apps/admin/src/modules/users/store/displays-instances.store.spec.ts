import { createPinia, setActivePinia } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type Mock, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';

import { type IUseBackend, useBackend } from '../../../common';
import { UsersApiException } from '../users.exceptions';

import { useDisplaysInstances } from './displays-instances.store';

const displayId = uuid();
const displayUid = uuid();

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
	PATCH: vi.fn(),
	DELETE: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: vi.fn(() => ({
			client: backendClient,
		})),
		getErrorReason: vi.fn(),
	};
});

describe('Displays Instances Store', (): void => {
	let displaysStore: ReturnType<typeof useDisplaysInstances>;
	let backendMock: IUseBackend;

	beforeEach((): void => {
		setActivePinia(createPinia());

		backendMock = useBackend();

		displaysStore = useDisplaysInstances();

		vi.clearAllMocks();
	});

	it('should fetch displays instances successfully', async (): Promise<void> => {
		(backendMock.client.GET as Mock).mockResolvedValue({
			data: {
				data: [
					{
						id: displayId,
						uid: displayUid,
						mac: '00:1A:2B:3C:4D:5E',
						version: '1.0.0',
						build: '42',
						user: uuid(),
						created_at: '2024-03-01T12:00:00Z',
						updated_at: '2024-03-02T12:00:00Z',
					},
				],
			},
		});

		await displaysStore.fetch();

		expect(displaysStore.findAll()).toHaveLength(1);
		expect(displaysStore.findById(displayId)?.mac).toBe('00:1A:2B:3C:4D:5E');
		expect(displaysStore.firstLoadFinished()).toBe(true);
	});

	it('should throw error when fetching displays instances fails', async (): Promise<void> => {
		(backendMock.client.GET as Mock).mockResolvedValue({ error: new Error('API error'), response: { status: 404 } });

		await expect(displaysStore.fetch()).rejects.toThrow(UsersApiException);
	});

	it('should add a display instances successfully', async (): Promise<void> => {
		(backendMock.client.POST as Mock).mockResolvedValue({
			data: {
				data: {
					id: displayId,
					uid: displayUid,
					mac: '00:1A:2B:3C:4D:5E',
					version: '1.0.0',
					build: '42',
					user: uuid(),
					created_at: '2024-03-01T12:00:00Z',
					updated_at: '2024-03-02T12:00:00Z',
				},
			},
		});

		const display = await displaysStore.add({
			id: displayId,
			draft: false,
			data: {
				uid: displayUid,
				mac: '00:1A:2B:3C:4D:5E',
				version: '1.0.0',
				build: '42',
				user: uuid(),
			},
		});

		expect(display.id).toBe(displayId);
		expect(displaysStore.findById(displayId)).toEqual(display);
	});

	it('should throw an error when adding a display instance fails', async (): Promise<void> => {
		(backendMock.client.POST as Mock).mockResolvedValue({ error: new Error('API error'), response: { status: 404 } });

		await expect(
			displaysStore.add({
				id: displayId,
				draft: false,
				data: {
					uid: displayUid,
					mac: '00:1A:2B:3C:4D:5E',
					version: '1.0.0',
					build: '42',
					user: uuid(),
				},
			})
		).rejects.toThrow(UsersApiException);
	});

	it('should edit a display instance successfully', async (): Promise<void> => {
		displaysStore.data[displayId] = {
			id: displayId,
			draft: false,
			uid: displayUid,
			mac: '00:1A:2B:3C:4D:5E',
			version: '1.0.0',
			build: '42',
			user: uuid(),
			displayProfile: null,
			createdAt: new Date(),
			updatedAt: null,
		};

		(backendMock.client.PATCH as Mock).mockResolvedValue({
			data: {
				data: {
					id: displayId,
					uid: displayUid,
					mac: '00:1A:2B:3C:4D:5E',
					version: '2.0.0',
					build: '42',
					user: uuid(),
					created_at: '2024-03-01T12:00:00Z',
					updated_at: '2024-03-02T12:00:00Z',
				},
			},
		});

		const updatedDisplay = await displaysStore.edit({
			id: displayId,
			data: { version: '2.0.0' },
		});

		expect(updatedDisplay.version).toBe('2.0.0');
		expect(displaysStore.findById(displayId)?.uid).toBe(displayUid);
	});

	it('should throw an error when editing a display instance fails', async (): Promise<void> => {
		displaysStore.data[displayId] = {
			id: displayId,
			uid: displayUid,
			mac: '00:1A:2B:3C:4D:5E',
			version: '1.0.0',
			build: '42',
			user: uuid(),
			draft: false,
			displayProfile: null,
			createdAt: new Date(),
			updatedAt: null,
		};

		(backendMock.client.PATCH as Mock).mockResolvedValue({ error: new Error('API error'), response: { status: 404 } });

		await expect(displaysStore.edit({ id: displayId, data: { version: '2.0.0' } })).rejects.toThrow(UsersApiException);
	});

	it('should remove a display instance successfully', async (): Promise<void> => {
		displaysStore.data[displayId] = {
			id: displayId,
			uid: displayUid,
			mac: '00:1A:2B:3C:4D:5E',
			version: '1.0.0',
			build: '42',
			user: uuid(),
			displayProfile: null,
			draft: false,
			createdAt: new Date(),
			updatedAt: null,
		};

		(backendMock.client.DELETE as Mock).mockResolvedValue({ response: { status: 204 } });

		const result = await displaysStore.remove({ id: displayId });

		expect(result).toBe(true);
		expect(displaysStore.findById(displayId)).toBe(null);
	});

	it('should throw an error when removing a display instance fails', async (): Promise<void> => {
		displaysStore.data[displayId] = {
			id: displayId,
			uid: displayUid,
			mac: '00:1A:2B:3C:4D:5E',
			version: '1.0.0',
			build: '42',
			user: uuid(),
			displayProfile: null,
			draft: false,
			createdAt: new Date(),
			updatedAt: null,
		};

		(backendMock.client.DELETE as Mock).mockResolvedValue({ error: new Error('API error'), response: { status: 404 } });

		await expect(displaysStore.remove({ id: displayId })).rejects.toThrow(UsersApiException);
	});
});
