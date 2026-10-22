import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLiveChat1792634736740 implements MigrationInterface {
  name = 'AddLiveChat1792634736740';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."chat_messages_sender_enum" AS ENUM('visitor', 'admin', 'auto')`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_messages" ("id" SERIAL NOT NULL, "conversationId" integer NOT NULL, "sender" "public"."chat_messages_sender_enum" NOT NULL, "body" text NOT NULL, "authorName" character varying(100), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_45745953065384cc9c4264c2a3" ON "chat_messages"  ("conversationId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."chat_conversations_status_enum" AS ENUM('Open', 'Closed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_conversations" ("id" SERIAL NOT NULL, "token" character varying(64) NOT NULL, "name" character varying(100) NOT NULL, "contact" character varying(30) NOT NULL, "page" character varying(120), "status" "public"."chat_conversations_status_enum" NOT NULL DEFAULT 'Open', "adminUnread" integer NOT NULL DEFAULT '0', "lastMessageAt" TIMESTAMP NOT NULL DEFAULT now(), "lastMessagePreview" character varying(200) NOT NULL DEFAULT '', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_18dfafc9bd1335dd44ef274eb14" UNIQUE ("token"), CONSTRAINT "PK_ff117d9f57807c4f2e3034a39f3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`ALTER TABLE "notifications" ADD "chatId" integer`);
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE 'chat'`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_45745953065384cc9c4264c2a3d" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_45745953065384cc9c4264c2a3d"`,
    );
    // Chat notifications can't be kept once the 'chat' type is gone.
    await queryRunner.query(
      `DELETE FROM "notifications" WHERE "type" = 'chat'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum_old" AS ENUM('booking', 'inquiry')`,
    );
    // The column default ('booking') blocks the type change, so drop and restore it.
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum_old" USING "type"::"text"::"public"."notifications_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum_old" RENAME TO "notifications_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'booking'`,
    );
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "chatId"`);
    await queryRunner.query(`DROP TABLE "chat_conversations"`);
    await queryRunner.query(
      `DROP TYPE "public"."chat_conversations_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_45745953065384cc9c4264c2a3"`,
    );
    await queryRunner.query(`DROP TABLE "chat_messages"`);
    await queryRunner.query(`DROP TYPE "public"."chat_messages_sender_enum"`);
  }
}
