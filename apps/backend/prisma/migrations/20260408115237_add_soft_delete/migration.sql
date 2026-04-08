-- AlterTable
ALTER TABLE "campaign_members" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "home_rules" ADD COLUMN     "deleted_at" TIMESTAMP(3);
