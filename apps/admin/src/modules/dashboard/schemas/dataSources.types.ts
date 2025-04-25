import { z } from 'zod';

import { DataSourceAddFormSchema, DataSourceEditFormSchema } from './dataSources.schemas';

export type IDataSourceAddForm = z.infer<typeof DataSourceAddFormSchema>;

export type IDataSourceEditForm = z.infer<typeof DataSourceEditFormSchema>;
