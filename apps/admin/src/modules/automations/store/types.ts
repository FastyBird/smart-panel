import { z } from 'zod';

export const ItemIdSchema = z.string().uuid();
