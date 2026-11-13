import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';

import { EventType as DevicesEventType } from '../../devices/devices.constants';
import { EventType as DisplaysEventType } from '../../displays/displays.constants';
import { EventType as UsersEventType } from '../../users/users.constants';
import { EventType } from '../cameras.constants';
import { CamerasForbiddenException, CamerasNotFoundException } from '../cameras.exceptions';

import { CameraSessionService } from './camera-session.service';

describe('CameraSessionService', () => {
	const input = {
		deviceId: 'c1',
		profileId: 'medium',
		transport: 'mse' as const,
		owner: { kind: 'user' as const, id: 'u1' },
	};

	let emitter: { emit: jest.Mock };
	let service: CameraSessionService;

	const sessionsOf = (s: CameraSessionService) => (s as never as { sessions: Map<string, unknown> }).sessions;

	beforeEach(() => {
		jest.useFakeTimers();
		emitter = { emit: jest.fn() };
		service = new CameraSessionService(emitter as unknown as EventEmitter2);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('issues a 43-character base64url token and a uuid session id', () => {
		const { session, token } = service.create(input);

		expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(session.expiresAt - Date.now()).toBe(60_000);
	});

	it('consumes a token exactly once', () => {
		const { session, token } = service.create(input);

		expect(service.consume(token)).toEqual(session);
		expect(service.consume(token)).toBeNull();
	});

	it('rejects an expired token', () => {
		const { token } = service.create(input);

		jest.advanceTimersByTime(60_001);

		expect(service.consume(token)).toBeNull();
	});

	it.each(['', 'x', 'a'.repeat(43), 'a'.repeat(5000)])('rejects the unknown token %#', (token) => {
		expect(service.consume(token)).toBeNull();
	});

	it('does not keep the raw token in memory', () => {
		const { token } = service.create(input);

		expect(JSON.stringify([...sessionsOf(service).entries()])).not.toContain(token);
	});

	it('revokes by owner and by device and reports the session ids', () => {
		const a = service.create(input);
		const b = service.create({ ...input, deviceId: 'c2' });
		const c = service.create({ ...input, owner: { kind: 'display', id: 'u1' } });

		service.revokeByOwner({ kind: 'user', id: 'u1' });

		expect(emitter.emit).toHaveBeenCalledWith(EventType.SESSION_REVOKED, {
			sessionIds: [a.session.id, b.session.id],
			reason: 'owner',
		});
		expect(service.consume(a.token)).toBeNull();
		expect(service.consume(c.token)).not.toBeNull();

		const d = service.create(input);

		service.revokeByDevice('c1');

		expect(emitter.emit).toHaveBeenLastCalledWith(EventType.SESSION_REVOKED, {
			sessionIds: [d.session.id],
			reason: 'device',
		});
	});

	it('does not emit when nothing was revoked', () => {
		service.revokeByDevice('nobody');

		expect(emitter.emit).not.toHaveBeenCalled();
	});

	it('drops the oldest pending session of an owner beyond 16', () => {
		const first = service.create(input);

		for (let i = 0; i < 16; i++) service.create(input);

		expect(service.consume(first.token)).toBeNull();
	});

	it('removes expired sessions when creating new ones', () => {
		for (let i = 0; i < 10; i++) service.create(input);

		jest.advanceTimersByTime(60_001);
		service.create(input);

		expect(sessionsOf(service).size).toBe(1);
	});

	describe('creation tickets', () => {
		const owner = input.owner;
		const tracked = (s: CameraSessionService) =>
			s as never as {
				openTickets: Set<unknown>;
				revokedOwners: Map<string, number>;
				revokedDevices: Map<string, number>;
			};

		it('creates a session when nothing was revoked meanwhile', () => {
			const ticket = service.beginCreate(owner, input.deviceId);
			const { session, token } = service.create(input, ticket);

			service.endCreate(ticket);

			expect(service.consume(token)).toEqual(session);
		});

		it.each([
			['device deleted', (s: CameraSessionService) => s.handleDeviceDeleted({ id: 'c1' }), CamerasNotFoundException],
			['display deleted', (s: CameraSessionService) => s.handleDisplayDeleted({ id: 'd1' }), CamerasForbiddenException],
			[
				'display token revoked',
				(s: CameraSessionService) => s.handleDisplayTokenRevoked({ id: 'd1' }),
				CamerasForbiddenException,
			],
			['user deleted', (s: CameraSessionService) => s.handleUserDeleted({ id: 'u1' }), CamerasForbiddenException],
		])('refuses to create after %s while the ticket is open', (_name, revoke, expected) => {
			const display = _name.startsWith('display');
			const ticketOwner = display ? { kind: 'display' as const, id: 'd1' } : owner;
			const ticket = service.beginCreate(ticketOwner, input.deviceId);

			revoke(service);

			expect(() => service.create({ ...input, owner: ticketOwner }, ticket)).toThrow(expected);
			expect(sessionsOf(service).size).toBe(0);

			service.endCreate(ticket);
		});

		it('ignores a revocation of another owner or device', () => {
			const ticket = service.beginCreate(owner, input.deviceId);

			service.revokeByOwner({ kind: 'user', id: 'someone-else' });
			service.revokeByDevice('another-device');

			expect(() => service.create(input, ticket)).not.toThrow();
		});

		it('does not hold a revocation against a ticket issued after it', () => {
			const early = service.beginCreate(owner, input.deviceId);

			service.revokeByDevice(input.deviceId);

			const late = service.beginCreate(owner, input.deviceId);

			expect(() => service.create(input, early)).toThrow(CamerasNotFoundException);
			expect(() => service.create(input, late)).not.toThrow();
		});

		it('remembers revocations only while a ticket is open', () => {
			service.revokeByDevice('c1');
			service.revokeByOwner(owner);

			expect(tracked(service).revokedDevices.size).toBe(0);
			expect(tracked(service).revokedOwners.size).toBe(0);

			const ticket = service.beginCreate(owner, 'c1');

			service.revokeByDevice('c1');
			service.revokeByOwner(owner);

			expect(tracked(service).revokedDevices.size).toBe(1);
			expect(tracked(service).revokedOwners.size).toBe(1);

			service.endCreate(ticket);
			service.endCreate(ticket);

			expect(tracked(service).openTickets.size).toBe(0);
			expect(tracked(service).revokedDevices.size).toBe(0);
			expect(tracked(service).revokedOwners.size).toBe(0);
		});
	});

	describe('event handlers', () => {
		let events: EventEmitter2;
		let real: CameraSessionService;

		beforeEach(async () => {
			jest.useRealTimers();

			const moduleRef = await Test.createTestingModule({
				imports: [EventEmitterModule.forRoot()],
				providers: [CameraSessionService],
			}).compile();

			await moduleRef.init();

			events = moduleRef.get(EventEmitter2);
			real = moduleRef.get(CameraSessionService);
		});

		it.each([
			[DevicesEventType.DEVICE_DELETED, { id: 'c1' }, 'device'],
			[DisplaysEventType.DISPLAY_DELETED, { id: 'd1' }, 'owner'],
			[DisplaysEventType.DISPLAY_TOKEN_REVOKED, { id: 'd1' }, 'owner'],
			[UsersEventType.USER_DELETED, { id: 'u1' }, 'owner'],
		])('revokes on %s', async (event, payload, reason) => {
			const matching = real.create({
				...input,
				deviceId: 'c1',
				owner: event.startsWith('Displays') ? { kind: 'display', id: 'd1' } : { kind: 'user', id: 'u1' },
			});
			const other = real.create({ ...input, deviceId: 'c9', owner: { kind: 'user', id: 'other' } });
			const revoked = jest.fn();

			events.on(EventType.SESSION_REVOKED, revoked);

			await events.emitAsync(event, payload);

			expect(real.consume(matching.token)).toBeNull();
			expect(real.consume(other.token)).not.toBeNull();
			expect(revoked).toHaveBeenCalledWith({ sessionIds: [matching.session.id], reason });
		});
	});
});
