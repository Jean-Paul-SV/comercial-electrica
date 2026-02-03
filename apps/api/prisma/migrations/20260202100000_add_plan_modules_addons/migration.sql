-- CreateTable: Plan
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "priceMonthly" DECIMAL(10,2),
    "priceYearly" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");

-- CreateTable: PlanFeature
CREATE TABLE "PlanFeature" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "moduleCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanFeature_planId_moduleCode_key" ON "PlanFeature"("planId", "moduleCode");
CREATE INDEX "PlanFeature_moduleCode_idx" ON "PlanFeature"("moduleCode");

-- AddColumn: Tenant.planId
ALTER TABLE "Tenant" ADD COLUMN "planId" UUID;

-- CreateTable: TenantModule
CREATE TABLE "TenantModule" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "moduleCode" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantModule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantModule_tenantId_moduleCode_key" ON "TenantModule"("tenantId", "moduleCode");
CREATE INDEX "TenantModule_tenantId_idx" ON "TenantModule"("tenantId");
CREATE INDEX "TenantModule_moduleCode_idx" ON "TenantModule"("moduleCode");

-- CreateTable: AddOn
CREATE TABLE "AddOn" (
    "id" UUID NOT NULL,
    "moduleCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceMonthly" DECIMAL(10,2),
    "priceYearly" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddOn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AddOn_moduleCode_key" ON "AddOn"("moduleCode");

-- CreateTable: TenantAddOn
CREATE TABLE "TenantAddOn" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "addOnId" UUID NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantAddOn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantAddOn_tenantId_addOnId_key" ON "TenantAddOn"("tenantId", "addOnId");
CREATE INDEX "TenantAddOn_tenantId_idx" ON "TenantAddOn"("tenantId");
CREATE INDEX "TenantAddOn_validUntil_idx" ON "TenantAddOn"("validUntil");

-- AddForeignKey: PlanFeature.planId -> Plan
ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Tenant.planId -> Plan
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: TenantModule.tenantId -> Tenant
ALTER TABLE "TenantModule" ADD CONSTRAINT "TenantModule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: TenantAddOn
ALTER TABLE "TenantAddOn" ADD CONSTRAINT "TenantAddOn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantAddOn" ADD CONSTRAINT "TenantAddOn_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "AddOn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
