-- Add the currently equipped avatar frame for shop skins.
ALTER TABLE "User" ADD COLUMN "equippedFrameItemId" TEXT;

CREATE INDEX "User_equippedFrameItemId_idx" ON "User"("equippedFrameItemId");

ALTER TABLE "User"
ADD CONSTRAINT "User_equippedFrameItemId_fkey"
FOREIGN KEY ("equippedFrameItemId") REFERENCES "ShopItem"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
