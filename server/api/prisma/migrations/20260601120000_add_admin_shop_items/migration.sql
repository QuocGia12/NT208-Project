-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ShopItemType" AS ENUM ('CARD', 'SKIN', 'ITEM');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "ShopItem" (
    "id" TEXT NOT NULL,
    "type" "ShopItemType" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "priceCoins" INTEGER NOT NULL DEFAULT 0,
    "priceGems" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopItem_pkey" PRIMARY KEY ("id")
);

-- Preserve existing Card shop data by copying it into ShopItem as CARD entries.
INSERT INTO "ShopItem" (
    "id",
    "type",
    "code",
    "name",
    "description",
    "imageUrl",
    "priceCoins",
    "priceGems",
    "isActive",
    "metadata",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    'CARD'::"ShopItemType",
    "code",
    "name",
    "description",
    "imageUrl",
    "priceCoins",
    "priceGems",
    "isActive",
    jsonb_build_object('rarity', "rarity"),
    "createdAt",
    "updatedAt"
FROM "Card"
ON CONFLICT ("id") DO NOTHING;

-- Repoint inventory from Card to ShopItem.
ALTER TABLE "UserInventory" DROP CONSTRAINT "UserInventory_cardId_fkey";
DROP INDEX "UserInventory_cardId_idx";
DROP INDEX "UserInventory_userId_cardId_key";

ALTER TABLE "UserInventory" RENAME COLUMN "cardId" TO "itemId";

-- CreateIndex
CREATE UNIQUE INDEX "ShopItem_code_key" ON "ShopItem"("code");
CREATE INDEX "ShopItem_type_isActive_idx" ON "ShopItem"("type", "isActive");
CREATE INDEX "UserInventory_itemId_idx" ON "UserInventory"("itemId");
CREATE UNIQUE INDEX "UserInventory_userId_itemId_key" ON "UserInventory"("userId", "itemId");

-- AddForeignKey
ALTER TABLE "UserInventory" ADD CONSTRAINT "UserInventory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ShopItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
