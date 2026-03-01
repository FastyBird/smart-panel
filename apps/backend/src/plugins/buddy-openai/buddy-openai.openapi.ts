import { UpdateBuddyOpenaiConfigDto } from './dto/update-config.dto';
import { BuddyOpenaiConfigModel } from './models/config.model';

export const BUDDY_OPENAI_PLUGIN_SWAGGER_EXTRA_MODELS = [BuddyOpenaiConfigModel, UpdateBuddyOpenaiConfigDto];
