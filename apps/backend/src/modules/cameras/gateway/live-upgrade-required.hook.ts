import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { CAMERAS_LIVE_PATH } from '../cameras.constants';

/**
 * Answers every plain HTTP request of `CAMERAS_LIVE_PATH` with the fixed `426 {"error":"upgrade_required"}` from a
 * Fastify `onRequest` hook, ahead of body parsing, routing, exception filters and loggers.
 *
 * The request url carries the session token. A request that fails before the controller runs (a malformed JSON body
 * under `Content-Type: application/json`, for example) would reach the global exception filters, which echo
 * `request.originalUrl` in their response and log it. Real WebSocket upgrades never get here: node emits them as
 * `upgrade` events, which `LiveStreamGateway` handles, and not as requests. A request that still carries an `Upgrade`
 * header got here because nothing took the upgrade, so it is answered too. `CamerasLiveController` stays as the
 * fallback for a server without Fastify hooks.
 *
 * A hook can only be added before the server is ready, so it is registered at module init.
 */
@Injectable()
export class LiveUpgradeRequiredHook implements OnModuleInit {
	constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

	onModuleInit(): void {
		// Absent (CLI context) or not Fastify: there is nothing to hook into.
		const instance = this.httpAdapterHost.httpAdapter?.getInstance<Partial<FastifyInstance> | undefined>();

		if (typeof instance?.addHook !== 'function') {
			return;
		}

		// Async, so that returning nothing lets the request go on (a callback-less sync hook would never continue).
		instance.addHook('onRequest', (request: FastifyRequest, reply: FastifyReply) =>
			Promise.resolve(this.answer(request, reply)),
		);
	}

	private answer(request: FastifyRequest, reply: FastifyReply): FastifyReply | undefined {
		const url = request.raw.url ?? '';
		const queryStart = url.indexOf('?');
		const pathname = queryStart === -1 ? url : url.slice(0, queryStart);

		if (pathname !== CAMERAS_LIVE_PATH) {
			return undefined;
		}

		// Returning the reply after `send` ends the request: no later hook, parser, route or filter runs.
		return reply.code(426).header('Upgrade', 'websocket').type('application/json').send({ error: 'upgrade_required' });
	}
}
