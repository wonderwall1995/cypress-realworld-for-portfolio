-- One like per member and transaction. This fails (and changes nothing) when duplicates are already stored: count them first.
CREATE UNIQUE INDEX "likes_userId_transactionId_key" ON "public"."likes"("userId", "transactionId");
