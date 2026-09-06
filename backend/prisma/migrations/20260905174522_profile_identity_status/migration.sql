-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "availability_from" TIMESTAMP(3),
ADD COLUMN     "availability_schedule_end" VARCHAR(5),
ADD COLUMN     "availability_schedule_start" VARCHAR(5),
ADD COLUMN     "short_name" VARCHAR(40);
