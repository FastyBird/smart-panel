import { useContainer } from 'class-validator';

import { LogLevel, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

import { API_PREFIX } from './app.constants';
import { AppModule } from './app.module';
import { BadRequestExceptionFilter } from './common/filters/bad-request-exception.filter';
import { GlobalErrorFilter } from './common/filters/global-error.filter';
import { InternalServerErrorExceptionFilter } from './common/filters/internal-server-error-exception.filter';
import { NotFoundExceptionFilter } from './common/filters/not-found-exception.filter';
import { QueryFailedExceptionFilter } from './common/filters/query-failed-exception.filter';
import { UnprocessableEntityExceptionFilter } from './common/filters/unprocessable-entity-exception.filter';
import { HeaderLocationInterceptor } from './common/interceptors/header-location.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { getEnvValue } from './common/utils/config.utils';
import { ValidationExceptionFactory } from './common/validation/validation-exception-factory';
import { WebsocketGateway } from './modules/websocket/gateway/websocket.gateway';

async function bootstrap() {
	const isProduction = process.env.NODE_ENV === 'production';

	const validLogLevels: LogLevel[] = ['verbose', 'debug', 'log', 'warn', 'error', 'fatal'];

	const logLevels =
		(process.env.FB_LOG_LEVEL?.split(',') as LogLevel[]) ??
		(isProduction ? ['log', 'warn', 'error', 'fatal'] : ['verbose', 'debug', 'log', 'warn', 'error', 'fatal']);

	const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
		logger: logLevels.filter((level): level is LogLevel => validLogLevels.includes(level)),
	});

	const reflector = app.get(Reflector);

	const configService = app.get(NestConfigService);
	const port = getEnvValue<number>(configService, 'FB_BACKEND_PORT', 3000);

	app.useGlobalFilters(
		new GlobalErrorFilter(),
		new InternalServerErrorExceptionFilter(),
		new BadRequestExceptionFilter(),
		new UnprocessableEntityExceptionFilter(),
		new NotFoundExceptionFilter(),
		new QueryFailedExceptionFilter(),
	);

	app.useGlobalPipes(
		new ValidationPipe({
			//transform: true, // Enables class-transformer transformation
			whitelist: true, // Strips properties not defined in DTO
			forbidNonWhitelisted: true, // Rejects requests with extra properties
			transformOptions: {
				enableImplicitConversion: true, // Automatically convert types
			},
			exceptionFactory: (validationErrors) => {
				return ValidationExceptionFactory.createException(validationErrors);
			},
		}),
	);

	app.useGlobalInterceptors(
		new ResponseInterceptor(reflector),
		new TransformResponseInterceptor(),
		new HeaderLocationInterceptor(app.get(NestConfigService)),
	);

	app.setGlobalPrefix(API_PREFIX);

	app.enableVersioning({
		type: VersioningType.URI,
		defaultVersion: '1',
	});

	// Optional: Make class-transformer aware of NestJS context
	useContainer(app.select(AppModule), { fallbackOnErrors: true });

	const websocketGateway = app.get(WebsocketGateway);
	websocketGateway.enable();

	app.enableCors();

	await app.listen(port, '0.0.0.0');
}

bootstrap().catch((error: Error) => {
	console.error(error);
});
