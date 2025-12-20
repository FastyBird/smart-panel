import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { WebsocketGateway } from '../gateway/websocket.gateway';
import { WEBSOCKET_MODULE_NAME } from '../websocket.constants';

@Injectable()
export class WsMetricsService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = createExtensionLogger(WEBSOCKET_MODULE_NAME, 'WsMetricsService');

	private beat: NodeJS.Timeout | null = null;

	private gauge: NodeJS.Timeout | null = null;

	constructor(
		private readonly influx: InfluxDbService,
		private readonly gateway: WebsocketGateway,
	) {}

	private getClientCount(): number {
		return this.gateway.clientsCount;
	}

	onModuleInit() {
		// heartbeat every 10s
		this.beat = setInterval(() => {
			this.influx
				.writePoints([
					{
						measurement: 'ws_heartbeat',
						fields: { n: 1 },
						timestamp: new Date(),
					},
				])
				.catch((err) => this.logger.error('heartbeat write failed', err));
		}, 10_000).unref();

		// clients gauge every 60s
		this.gauge = setInterval(() => {
			this.influx
				.writePoints([
					{
						measurement: 'ws_conn',
						fields: { clients: this.getClientCount() },
						timestamp: new Date(),
					},
				])
				.catch((err) => this.logger.error('clients gauge write failed', err));
		}, 60_000).unref();
	}

	onModuleDestroy() {
		if (this.beat) {
			clearInterval(this.beat);
		}

		if (this.gauge) {
			clearInterval(this.gauge);
		}
	}
}
