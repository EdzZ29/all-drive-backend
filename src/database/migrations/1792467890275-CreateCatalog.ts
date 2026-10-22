import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCatalog1792467890275 implements MigrationInterface {
  name = 'CreateCatalog1792467890275';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "car_classes" ("id" character varying(20) NOT NULL, "rates" jsonb NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fe104ecebd2e9f428922314450d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."car_models_availability_enum" AS ENUM('available', 'unavailable', 'hidden')`,
    );
    await queryRunner.query(
      `CREATE TABLE "car_models" ("id" character varying(60) NOT NULL, "availability" "public"."car_models_availability_enum" NOT NULL DEFAULT 'available', "rates" jsonb, "photos" jsonb NOT NULL DEFAULT '[]'::jsonb, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ee4355345e0e1c18cb6efa2bd5c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "catalog_settings" ("id" integer NOT NULL, "driverRate" integer, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cc0bd90d42c7787e3de96286065" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "catalog_settings"`);
    await queryRunner.query(`DROP TABLE "car_models"`);
    await queryRunner.query(
      `DROP TYPE "public"."car_models_availability_enum"`,
    );
    await queryRunner.query(`DROP TABLE "car_classes"`);
  }
}
