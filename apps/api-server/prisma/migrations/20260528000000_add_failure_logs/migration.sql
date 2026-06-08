CREATE TABLE "FailureLog" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "queryParams" JSONB NOT NULL,
    "requestHeaders" JSONB NOT NULL,
    "requestBody" JSONB,
    "responseStatus" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "errorStack" TEXT,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FailureLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FailureLog_createdAt_idx" ON "FailureLog"("createdAt");
CREATE INDEX "FailureLog_responseStatus_idx" ON "FailureLog"("responseStatus");
