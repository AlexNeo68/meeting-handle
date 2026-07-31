-- RenameColumn
ALTER TABLE "MeetingFile" RENAME COLUMN "storageName" TO "storagePath";

-- RenameIndex
ALTER INDEX "MeetingFile_storageName_key" RENAME TO "MeetingFile_storagePath_key";

-- AddForeignKey
ALTER TABLE "MeetingFile" ADD CONSTRAINT "MeetingFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
