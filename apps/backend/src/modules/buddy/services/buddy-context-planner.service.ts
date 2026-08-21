import { Injectable } from '@nestjs/common';

import { BuddyContextPlan, BuddyContextPlannerInput } from '../models/context-plan.model';

import { planBuddyContext } from './context-planner/buddy-context-planning-pipeline';

@Injectable()
export class BuddyContextPlannerService {
	plan(input: BuddyContextPlannerInput): BuddyContextPlan {
		return planBuddyContext(input);
	}
}
