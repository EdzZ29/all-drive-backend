import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { connectionOptions } from './database.options';

const logger = new Logger('LegacyUpgrade');

// One-time upgrade from the old "client accounts" schema, where bookings
// belonged to a registered client user, to guest bookings from the website
// that carry the customer's details themselves.
//
// It must run BEFORE TypeORM's synchronize: removing 'client' from the users
// role enum fails while client rows exist, and dropping bookings.clientId would
// lose who made each booking. So this copies each client's name, email and
// phone onto their bookings, drops the clientId link, then deletes the client
// accounts. Safe to run on every boot: it does nothing once upgraded (or on a
// fresh database). Only needed where synchronize is on (local development);
// production databases start fresh and use migrations.
//
// Reads the DB settings from process.env, which ConfigModule.forRoot() fills
// from .env as soon as AppModule is imported.
export async function upgradeLegacySchema() {
  const dataSource = new DataSource({
    ...connectionOptions((key) => process.env[key]),
    synchronize: false,
  });
  await dataSource.initialize();
  const runner = dataSource.createQueryRunner();

  try {
    const run = (sql: string, params?: unknown[]) =>
      runner.query(sql, params, true);

    const bookingsHaveClient = await runner.hasColumn('bookings', 'clientId');
    const clientAccounts =
      (await runner.hasColumn('users', 'role')) &&
      (await run(`SELECT 1 FROM users WHERE role::text = 'client' LIMIT 1`))
        .records.length > 0;
    if (!bookingsHaveClient && !clientAccounts) return;

    await runner.startTransaction();

    if (bookingsHaveClient) {
      // Same types as the Booking entity, so synchronize keeps the data.
      await run(`
        ALTER TABLE bookings
          ADD COLUMN IF NOT EXISTS "reference" varchar(20),
          ADD COLUMN IF NOT EXISTS "customerName" varchar(100),
          ADD COLUMN IF NOT EXISTS "customerPhone" varchar(30),
          ADD COLUMN IF NOT EXISTS "customerEmail" varchar(120),
          ADD COLUMN IF NOT EXISTS "carLabel" varchar(120) NOT NULL DEFAULT '',
          ADD COLUMN IF NOT EXISTS "days" integer NOT NULL DEFAULT 1
      `);
      const moved = await run(`
        UPDATE bookings b SET
          "reference" = COALESCE(b."reference", 'AD-OLD-' || b.id),
          "customerName" = COALESCE(u.name, 'Customer #' || b."clientId"),
          "customerEmail" = u.email,
          "customerPhone" = COALESCE(NULLIF(b."contactPhone", ''), u.phone, ''),
          "carLabel" = COALESCE(v.brand || ' ' || v.model, ''),
          "days" = GREATEST(1, b."endDate" - b."startDate")
        FROM bookings src
          LEFT JOIN users u ON u.id = src."clientId"
          LEFT JOIN vehicles v ON v.id = src."vehicleId"
        WHERE src.id = b.id
      `);
      // Also drops the foreign key to users.
      await run(`ALTER TABLE bookings DROP COLUMN "clientId"`);
      logger.log(
        `Moved customer details onto ${moved.affected ?? 0} existing booking(s)`,
      );
    }

    if (clientAccounts) {
      const removed = await run(
        `DELETE FROM users WHERE role::text = 'client'`,
      );
      logger.log(
        `Removed ${removed.affected ?? 0} client account(s); customers now book through the website`,
      );
    }

    await runner.commitTransaction();
  } catch (err) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    throw err;
  } finally {
    await runner.release();
    await dataSource.destroy();
  }
}
