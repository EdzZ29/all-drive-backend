import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1792465087407 implements MigrationInterface {
  name = 'InitialSchema1792465087407';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."vehicles_status_enum" AS ENUM('Available', 'Booked', 'Maintenance', 'Unlisted')`,
    );
    await queryRunner.query(
      `CREATE TABLE "vehicles" ("id" SERIAL NOT NULL, "brand" character varying NOT NULL, "model" character varying NOT NULL, "vehicleType" character varying NOT NULL, "year" integer NOT NULL, "color" character varying NOT NULL, "plateNumber" character varying NOT NULL, "transmission" character varying NOT NULL, "fuelType" character varying NOT NULL, "seats" integer NOT NULL, "dailyRate" numeric NOT NULL, "description" character varying NOT NULL, "status" "public"."vehicles_status_enum" NOT NULL DEFAULT 'Available', "image" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_66ea96381a7a7ceb35c72f36625" UNIQUE ("plateNumber"), CONSTRAINT "PK_18d8646b59304dce4af3a9e35b6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_drivetype_enum" AS ENUM('Self Drive', 'With Driver')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_handover_enum" AS ENUM('Pickup', 'Delivery')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_paymentmethod_enum" AS ENUM('GCash', 'Maya', 'Bank Transfer', 'Cash')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_paymentstatus_enum" AS ENUM('Unpaid', 'Down Payment', 'Fully Paid')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_status_enum" AS ENUM('Pending', 'Approved', 'Declined', 'Returned', 'Completed', 'Cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "bookings" ("id" SERIAL NOT NULL, "reference" character varying(20) NOT NULL, "customerName" character varying(100) NOT NULL, "customerPhone" character varying(30) NOT NULL, "customerEmail" character varying(120), "customerAddress" character varying(200) NOT NULL DEFAULT '', "customerWork" character varying(200) NOT NULL DEFAULT '', "carCategory" character varying(20), "carModel" character varying(60), "carLabel" character varying(120) NOT NULL DEFAULT '', "vehicleId" integer, "destination" character varying(120) NOT NULL DEFAULT '', "rateZone" character varying(60) NOT NULL DEFAULT '', "specificPlace" character varying(200), "startDate" date NOT NULL, "endDate" date NOT NULL, "pickupTime" character varying(20), "days" integer NOT NULL DEFAULT '1', "driveType" "public"."bookings_drivetype_enum" NOT NULL DEFAULT 'Self Drive', "yearsDriving" integer, "purpose" text NOT NULL DEFAULT '', "handover" "public"."bookings_handover_enum" NOT NULL DEFAULT 'Pickup', "location" character varying(255), "estimatedTotal" numeric, "estimateText" character varying(120) NOT NULL DEFAULT '', "totalPrice" numeric, "paymentMethod" "public"."bookings_paymentmethod_enum", "paymentStatus" "public"."bookings_paymentstatus_enum" NOT NULL DEFAULT 'Unpaid', "notes" text, "status" "public"."bookings_status_enum" NOT NULL DEFAULT 'Pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d7eca65f0a4d442ec4491f2f804" UNIQUE ("reference"), CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."inquiries_status_enum" AS ENUM('New', 'Contacted', 'Closed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "inquiries" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "contact" character varying(30) NOT NULL, "email" character varying(120), "topic" character varying(60) NOT NULL, "message" text NOT NULL, "page" character varying(120), "status" "public"."inquiries_status_enum" NOT NULL DEFAULT 'New', "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ceacaa439988b25eb9459e694d9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('booking', 'inquiry')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" SERIAL NOT NULL, "type" "public"."notifications_type_enum" NOT NULL DEFAULT 'booking', "title" character varying(160) NOT NULL, "message" character varying(500) NOT NULL, "bookingId" integer, "inquiryId" integer, "read" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('admin')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "phone" character varying, "role" "public"."users_role_enum" NOT NULL DEFAULT 'admin', "isActive" boolean NOT NULL DEFAULT true, "tokenVersion" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_30909e71d6dd969e95d995258f1" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_30909e71d6dd969e95d995258f1"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(`DROP TABLE "inquiries"`);
    await queryRunner.query(`DROP TYPE "public"."inquiries_status_enum"`);
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TYPE "public"."bookings_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."bookings_paymentstatus_enum"`);
    await queryRunner.query(`DROP TYPE "public"."bookings_paymentmethod_enum"`);
    await queryRunner.query(`DROP TYPE "public"."bookings_handover_enum"`);
    await queryRunner.query(`DROP TYPE "public"."bookings_drivetype_enum"`);
    await queryRunner.query(`DROP TABLE "vehicles"`);
    await queryRunner.query(`DROP TYPE "public"."vehicles_status_enum"`);
  }
}
