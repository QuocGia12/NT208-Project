ALTER TABLE "User" ADD COLUMN "equippedMapItemId" TEXT;

CREATE INDEX "User_equippedMapItemId_idx" ON "User"("equippedMapItemId");

ALTER TABLE "User"
ADD CONSTRAINT "User_equippedMapItemId_fkey"
FOREIGN KEY ("equippedMapItemId") REFERENCES "ShopItem"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
