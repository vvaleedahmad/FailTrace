CREATE TABLE "ApiLog" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "requestId" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApiLog_endpoint_idx" ON "ApiLog"("endpoint");
CREATE INDEX "ApiLog_createdAt_idx" ON "ApiLog"("createdAt");
CREATE INDEX "ApiLog_statusCode_idx" ON "ApiLog"("statusCode");
CREATE INDEX "ApiLog_service_idx" ON "ApiLog"("service");
