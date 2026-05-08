/*
  Warnings:

  - Added the required column `passwordHash` to the `Comment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Comment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "passwordHash" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "developer" TEXT,
ADD COLUMN     "difficulty" INTEGER,
ADD COLUMN     "year" INTEGER;
