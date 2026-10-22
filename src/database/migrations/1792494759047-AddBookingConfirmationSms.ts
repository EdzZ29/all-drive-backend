import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingConfirmationSms1792494759047 implements MigrationInterface {
  name = 'AddBookingConfirmationSms1792494759047';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "confirmationSmsSentAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN "confirmationSmsSentAt"`,
    );
  }
}
