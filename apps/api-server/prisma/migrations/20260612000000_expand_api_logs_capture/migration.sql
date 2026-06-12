ALTER TABLE "ApiLog"
ADD COLUMN "statusMessage" TEXT,
ADD COLUMN "host" TEXT,
ADD COLUMN "protocol" TEXT,
ADD COLUMN "httpVersion" TEXT,
ADD COLUMN "queryParams" JSONB,
ADD COLUMN "routeParams" JSONB,
ADD COLUMN "requestHeaders" JSONB,
ADD COLUMN "requestBody" JSONB,
ADD COLUMN "responseHeaders" JSONB,
ADD COLUMN "responseBody" JSONB,
ADD COLUMN "responseContentLength" TEXT;
