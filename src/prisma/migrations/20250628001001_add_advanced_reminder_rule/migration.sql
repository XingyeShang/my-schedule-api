/*
  Warnings:

  - You are about to drop the column `reminderTime` on the `Event` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Event" DROP COLUMN "reminderTime",
ADD COLUMN     "reminderUnit" TEXT,
ADD COLUMN     "reminderValue" INTEGER;
