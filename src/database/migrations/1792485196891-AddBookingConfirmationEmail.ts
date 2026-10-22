import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingConfirmationEmail1792485196891 implements MigrationInterface {
  name = 'AddBookingConfirmationEmail1792485196891';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "confirmationEmailSentAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN "confirmationEmailSentAt"`,
    );
  }
}
