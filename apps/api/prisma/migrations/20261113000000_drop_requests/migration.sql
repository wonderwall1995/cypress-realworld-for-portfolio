-- The "request -> notice -> accept" flow is gone. Remove what it left behind, then the two columns.
-- (In the development database: 2 rejected requests, 2 read notices, no likes, comments or transfers.)
DELETE FROM "likes" WHERE "transactionId" IN (SELECT "id" FROM "transactions" WHERE "requestStatus" <> '');
DELETE FROM "comments" WHERE "transactionId" IN (SELECT "id" FROM "transactions" WHERE "requestStatus" <> '');
DELETE FROM "notifications"
  WHERE "status" = 'requested'
     OR "transactionId" IN (SELECT "id" FROM "transactions" WHERE "requestStatus" <> '');
DELETE FROM "transactions" WHERE "requestStatus" <> '';

ALTER TABLE "transactions" DROP COLUMN "requestStatus";
ALTER TABLE "transactions" DROP COLUMN "requestResolvedAt";
