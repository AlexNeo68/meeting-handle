-- CreateIndex
CREATE INDEX "Meeting_userId_date_idx" ON "Meeting"("userId", "date" DESC);
