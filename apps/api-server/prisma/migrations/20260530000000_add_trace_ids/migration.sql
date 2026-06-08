ALTER TABLE "ApiLog" ADD COLUMN "traceId" TEXT;
ALTER TABLE "FailureLog" ADD COLUMN "traceId" TEXT;
ALTER TABLE "ReplayResult" ADD COLUMN "traceId" TEXT;

CREATE INDEX "ApiLog_traceId_idx" ON "ApiLog"("traceId");
CREATE INDEX "FailureLog_traceId_idx" ON "FailureLog"("traceId");
CREATE INDEX "ReplayResult_traceId_idx" ON "ReplayResult"("traceId");
