import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePushSubscriptions1792465189537 implements MigrationInterface {
  name = 'CreatePushSubscriptions1792465189537';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "push_subscriptions" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "endpoint" text NOT NULL, "p256dh" character varying(255) NOT NULL, "auth" character varying(255) NOT NULL, "user_agent" character varying(500), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0008bdfd174e533a3f98bf9af16" UNIQUE ("endpoint"), CONSTRAINT "PK_757fc8f00c34f66832668dc2e53" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "push_subscriptions" ADD CONSTRAINT "FK_6771f119f1c06d2ccf38f238664" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "push_subscriptions" DROP CONSTRAINT "FK_6771f119f1c06d2ccf38f238664"`,
    );
    await queryRunner.query(`DROP TABLE "push_subscriptions"`);
  }
}
