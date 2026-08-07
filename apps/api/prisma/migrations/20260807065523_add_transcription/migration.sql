-- CreateEnum
CREATE TYPE "TranscriptionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "MeetingFile" ADD COLUMN     "transcribedAt" TIMESTAMP(3),
ADD COLUMN     "transcript" TEXT,
ADD COLUMN     "transcriptionError" TEXT,
ADD COLUMN     "transcriptionLanguage" TEXT,
ADD COLUMN     "transcriptionProgress" INTEGER,
ADD COLUMN     "transcriptionStatus" "TranscriptionStatus";

-- CreateIndex
CREATE INDEX "MeetingFile_transcriptionStatus_idx" ON "MeetingFile"("transcriptionStatus");
