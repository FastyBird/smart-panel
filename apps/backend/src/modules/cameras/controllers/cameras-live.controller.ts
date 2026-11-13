import { FastifyReply } from 'fastify';

import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../../auth/guards/auth.guard';
import { CAMERAS_MODULE_API_TAG_NAME } from '../cameras.constants';

/**
 * Answers a plain `GET` (no `Upgrade`) of the live socket path. Live sockets themselves are upgraded by
 * `LiveStreamGateway` and never reach Fastify routing; without this route such a request ends in Nest's not-found
 * handling, whose body echoes the request url, and with it the session token, three times.
 *
 * The body is fixed and the route reveals nothing about the module: it is not behind the module-enabled guard (a
 * refusal there would echo the url as well), it needs no authentication (a refusal there would too) and it is not
 * throttled (a rejection would). The session is not consumed.
 */
@ApiTags(CAMERAS_MODULE_API_TAG_NAME)
@Controller('live')
export class CamerasLiveController {
	@Public()
	@SkipThrottle()
	@ApiExcludeEndpoint()
	@Get()
	upgradeRequired(@Res() reply: FastifyReply): void {
		void reply.code(426).header('Upgrade', 'websocket').type('application/json').send({ error: 'upgrade_required' });
	}
}
