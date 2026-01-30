import { Injectable } from '@nestjs/common';

import { SecurityStatusModel } from '../models/security-status.model';

import { SecurityAggregatorService } from './security-aggregator.service';

@Injectable()
export class SecurityService {
	constructor(private readonly aggregator: SecurityAggregatorService) {}

	async getStatus(): Promise<SecurityStatusModel> {
		return this.aggregator.aggregate();
	}
}
