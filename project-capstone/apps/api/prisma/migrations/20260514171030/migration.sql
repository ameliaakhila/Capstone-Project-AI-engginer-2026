-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PASAR', 'MINIMARKET', 'SUPERMARKET');

-- CreateEnum
CREATE TYPE "PermitStatus" AS ENUM ('APPROVED', 'UNDER_REVIEW', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ViolationStatus" AS ENUM ('ACTIVE', 'UNDER_REVIEW', 'RESOLVED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'WARNING', 'ELEVATED', 'STABLE');

-- CreateEnum
CREATE TYPE "DistrictStatus" AS ENUM ('CRITICAL', 'WARNING', 'ELEVATED', 'SAFE', 'STABLE');

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('PROXIMITY', 'DENSITY', 'CAPACITY');

-- CreateEnum
CREATE TYPE "AuditPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "districts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "saturationPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "DistrictStatus" NOT NULL DEFAULT 'STABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EntityType" NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "placeId" TEXT,
    "store" TEXT,
    "kelurahan" TEXT,
    "rating" DOUBLE PRECISION DEFAULT 0,
    "totalRatings" INTEGER DEFAULT 0,
    "permitStatus" "PermitStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
    "complianceScore" DOUBLE PRECISION DEFAULT 0,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "districtId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "ruleType" "RuleType" NOT NULL DEFAULT 'PROXIMITY',
    "severity" "Severity" NOT NULL DEFAULT 'WARNING',
    "status" "ViolationStatus" NOT NULL DEFAULT 'ACTIVE',
    "distanceM" DOUBLE PRECISION,
    "entityId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "zoningRuleId" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zoning_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ruleType" "RuleType" NOT NULL,
    "minDistanceMeters" DOUBLE PRECISION,
    "maxEntitiesPerZone" INTEGER,
    "targetEntityType" "EntityType" NOT NULL,
    "referenceEntityType" "EntityType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zoning_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audits" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "priority" "AuditPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "findings" TEXT,
    "entityId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saturation_logs" (
    "id" TEXT NOT NULL,
    "saturationPercent" DOUBLE PRECISION NOT NULL,
    "violationCount" INTEGER NOT NULL DEFAULT 0,
    "districtId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saturation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flagged_clusters" (
    "id" TEXT NOT NULL,
    "streetName" TEXT NOT NULL,
    "description" TEXT,
    "entityCount" INTEGER NOT NULL DEFAULT 0,
    "districtId" TEXT NOT NULL,

    CONSTRAINT "flagged_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_forecasts" (
    "id" TEXT NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,
    "prediction" TEXT NOT NULL,
    "timeframeMonths" INTEGER NOT NULL DEFAULT 6,
    "districtId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "districts_name_key" ON "districts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "districts_code_key" ON "districts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "entities_placeId_key" ON "entities"("placeId");

-- CreateIndex
CREATE INDEX "entities_districtId_idx" ON "entities"("districtId");

-- CreateIndex
CREATE INDEX "entities_type_idx" ON "entities"("type");

-- CreateIndex
CREATE INDEX "entities_latitude_longitude_idx" ON "entities"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "violations_code_key" ON "violations"("code");

-- CreateIndex
CREATE INDEX "violations_status_idx" ON "violations"("status");

-- CreateIndex
CREATE INDEX "violations_severity_idx" ON "violations"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "audits_code_key" ON "audits"("code");

-- CreateIndex
CREATE INDEX "saturation_logs_districtId_recordedAt_idx" ON "saturation_logs"("districtId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_zoningRuleId_fkey" FOREIGN KEY ("zoningRuleId") REFERENCES "zoning_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saturation_logs" ADD CONSTRAINT "saturation_logs_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flagged_clusters" ADD CONSTRAINT "flagged_clusters_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_forecasts" ADD CONSTRAINT "ai_forecasts_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
