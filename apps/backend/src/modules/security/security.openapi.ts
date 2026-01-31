import {
	SecurityAlertAckAllResponseModel,
	SecurityAlertAckModel,
	SecurityAlertAckResponseModel,
} from './models/security-alert-ack-response.model';
import { SecurityEventModel, SecurityEventsResponseModel } from './models/security-event-response.model';
import { SecurityStatusResponseModel } from './models/security-response.model';
import { SecurityAlertModel, SecurityLastEventModel, SecurityStatusModel } from './models/security-status.model';

export const SECURITY_SWAGGER_EXTRA_MODELS = [
	// Response models
	SecurityStatusResponseModel,
	SecurityAlertAckResponseModel,
	SecurityAlertAckAllResponseModel,
	SecurityEventsResponseModel,
	// Data models
	SecurityStatusModel,
	SecurityAlertModel,
	SecurityLastEventModel,
	SecurityAlertAckModel,
	SecurityEventModel,
];
