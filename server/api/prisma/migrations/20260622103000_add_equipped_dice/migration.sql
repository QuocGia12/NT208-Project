ALTER TABLE "User" ADD COLUMN "equippedDiceItemId" TEXT;

CREATE INDEX "User_equippedDiceItemId_idx" ON "User"("equippedDiceItemId");

ALTER TABLE "User"
ADD CONSTRAINT "User_equippedDiceItemId_fkey"
FOREIGN KEY ("equippedDiceItemId") REFERENCES "ShopItem"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
