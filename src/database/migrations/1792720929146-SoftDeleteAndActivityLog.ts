import { MigrationInterface, QueryRunner } from 'typeorm';

export class SoftDeleteAndActivityLog1792720929146 implements MigrationInterface {
  name = 'SoftDeleteAndActivityLog1792720929146';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."audit_logs_actortype_enum" AS ENUM('admin', 'website', 'system')`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "actorType" "public"."audit_logs_actortype_enum" NOT NULL, "actorId" integer, "actorName" character varying(120) NOT NULL, "action" character varying(60) NOT NULL, "entityType" character varying(30) NOT NULL, "entityId" integer, "entityLabel" character varying(160) NOT NULL DEFAULT '', "summary" character varying(500) NOT NULL, "details" jsonb, CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c69efb19bf127c97e6740ad530" ON "audit_logs"  ("createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_13c69424c440a0e765053feb4b" ON "audit_logs"  ("entityType", "entityId") `,
    );
    await queryRunner.query(`ALTER TABLE "vehicles" ADD "deletedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "bookings" ADD "deletedAt" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TABLE "chat_conversations" ADD "deletedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "inquiries" ADD "deletedAt" TIMESTAMP`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "deletedAt" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "inquiries" DROP COLUMN "deletedAt"`);
    await queryRunner.query(
      `ALTER TABLE "chat_conversations" DROP COLUMN "deletedAt"`,
    );
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "vehicles" DROP COLUMN "deletedAt"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_13c69424c440a0e765053feb4b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c69efb19bf127c97e6740ad530"`,
    );
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TYPE "public"."audit_logs_actortype_enum"`);
  }
}
