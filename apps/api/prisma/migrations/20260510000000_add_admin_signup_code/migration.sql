CREATE TABLE "AdminSignupCode" (
    "id" TEXT NOT NULL,
    "codeKey" TEXT NOT NULL DEFAULT 'MANAGER_SIGNUP',
    "codeHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSignupCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminSignupCode_codeKey_key" ON "AdminSignupCode"("codeKey");
