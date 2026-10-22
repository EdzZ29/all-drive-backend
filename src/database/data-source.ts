import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';

import { MIGRATIONS_GLOB, connectionOptions } from './database.options';

// Used only by the TypeORM CLI (npm run migration:*), against the compiled
// files in dist/. The app itself connects through TypeOrmModule in app.module.
export default new DataSource({
  ...connectionOptions((key) => process.env[key]),
  entities: [join(__dirname, '..', '**', '*.entity.js')],
  migrations: [MIGRATIONS_GLOB],
  synchronize: false,
});
