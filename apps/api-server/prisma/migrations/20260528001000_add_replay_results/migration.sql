ALTER TABLE "FailureLog" ADD COLUMN "responseHeaders" JSONB;
ALTER TABLE "FailureLog" ADD COLUMN "responseBody" JSONB;

CREATE TABLE "ReplayResult" (
    "id" TEXT NOT NULL,
    "failureLogId" TEXT NOT NULL,
    "replayUrl" TEXT NOT NULL,
    "replayStatus" INTEGER,
    "replayResponseHeaders" JSONB,
    "replayResponseBody" JSONB,
    "replayErrorMessage" TEXT,
    "matchedStatus" BOOLEAN NOT NULL,
    "matchedBody" BOOLEAN NOT NULL,
    "matchedErrorMessage" BOOLEAN NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplayResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReplayResult_failureLogId_idx" ON "ReplayResult"("failureLogId");
CREATE INDEX "ReplayResult_createdAt_idx" ON "ReplayResult"("createdAt");

ALTER TABLE "ReplayResult"
ADD CONSTRAINT "ReplayResult_failureLogId_fkey"
FOREIGN KEY ("failureLogId") REFERENCES "FailureLog"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
