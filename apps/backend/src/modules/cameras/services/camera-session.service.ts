import { createHash, randomBytes, randomUUID } from 'crypto';

import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { EventType as DevicesEventType } from '../../devices/devices.constants';
import { EventType as DisplaysEventType } from '../../displays/displays.constants';
import { EventType as UsersEventType } from '../../users/users.constants';
import { EventType } from '../cameras.constants';
import { CameraSessionOwner } from '../cameras.utils';

export type CameraSessionTransport = 'mse';

export interface CameraStreamSession {
	id: string; // uuid v4, safe to log and return
	deviceId: string;
	profileId: string;
	transport: CameraSessionTransport;
	owner: CameraSessionOwner;
	expiresAt: number; // epoch ms
}

export interface CameraSessionRevokedEvent {
	sessionIds: string[];
	reason: 'owner' | 'device';
}

export const CAMERA_SESSION_TTL_MS = 60_000;
export const CAMERA_SESSION_MAX_PENDING_PER_OWNER = 16;

/**
 * Short-lived, single-use stream sessions. Only the SHA-256 hex of a token is stored; the raw token is handed to the
 * caller once and never kept, logged or emitted.
 */
@Injectable()
export class CameraSessionService {
	private readonly sessions = new Map<string, CameraStreamSession>();

	constructor(private readonly eventEmitter: EventEmitter2) {}

	create(input: Omit<CameraStreamSession, 'id' | 'expiresAt'>): { session: CameraStreamSession; token: string } {
		const now = Date.now();

		this.removeExpired(now);

		const token = randomBytes(32).toString('base64url');
		const session: CameraStreamSession = { ...input, id: randomUUID(), expiresAt: now + CAMERA_SESSION_TTL_MS };

		this.sessions.set(this.hash(token), session);

		const ownerKeys = [...this.sessions.entries()].filter(
			([, s]) => s.owner.kind === input.owner.kind && s.owner.id === input.owner.id,
		);

		// Map iteration is insertion ordered, so the oldest pending sessions come first.
		for (const [key] of ownerKeys.slice(0, Math.max(0, ownerKeys.length - CAMERA_SESSION_MAX_PENDING_PER_OWNER))) {
			this.sessions.delete(key);
		}

		return { session, token };
	}

	/** Single use: the entry is removed before its expiry is checked. */
	consume(token: string): CameraStreamSession | null {
		if (typeof token !== 'string' || token.length === 0 || token.length > 256) {
			return null;
		}

		const key = this.hash(token);
		const session = this.sessions.get(key);

		if (!session) {
			return null;
		}

		this.sessions.delete(key);

		return session.expiresAt > Date.now() ? session : null;
	}

	revokeByOwner(owner: CameraSessionOwner): void {
		this.revoke((s) => s.owner.kind === owner.kind && s.owner.id === owner.id, 'owner');
	}

	revokeByDevice(deviceId: string): void {
		this.revoke((s) => s.deviceId === deviceId, 'device');
	}

	@OnEvent(DevicesEventType.DEVICE_DELETED)
	handleDeviceDeleted(payload: { id: string }): void {
		this.revokeByDevice(payload.id);
	}

	@OnEvent(DisplaysEventType.DISPLAY_DELETED)
	handleDisplayDeleted(payload: { id: string }): void {
		this.revokeByOwner({ kind: 'display', id: payload.id });
	}

	@OnEvent(DisplaysEventType.DISPLAY_TOKEN_REVOKED)
	handleDisplayTokenRevoked(payload: { id: string }): void {
		this.revokeByOwner({ kind: 'display', id: payload.id });
	}

	@OnEvent(UsersEventType.USER_DELETED)
	handleUserDeleted(payload: { id: string }): void {
		this.revokeByOwner({ kind: 'user', id: payload.id });
	}

	private revoke(
		predicate: (session: CameraStreamSession) => boolean,
		reason: CameraSessionRevokedEvent['reason'],
	): void {
		const sessionIds: string[] = [];

		for (const [key, session] of this.sessions) {
			if (predicate(session)) {
				this.sessions.delete(key);
				sessionIds.push(session.id);
			}
		}

		if (sessionIds.length > 0) {
			const event: CameraSessionRevokedEvent = { sessionIds, reason };

			this.eventEmitter.emit(EventType.SESSION_REVOKED, event);
		}
	}

	private removeExpired(now: number): void {
		for (const [key, session] of this.sessions) {
			if (session.expiresAt <= now) {
				this.sessions.delete(key);
			}
		}
	}

	private hash(token: string): string {
		return createHash('sha256').update(token).digest('hex');
	}
}
