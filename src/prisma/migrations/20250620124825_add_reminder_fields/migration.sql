-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "isReminderSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminderTime" TIMESTAMP(3);
