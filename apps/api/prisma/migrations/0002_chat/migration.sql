-- AlterTable
ALTER TABLE "game_participants" ADD COLUMN     "muted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "game_messages" (
    "id" SERIAL NOT NULL,
    "game_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "player_id" TEXT,
    "name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "game_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_messages_game_id_id_idx" ON "game_messages"("game_id", "id");

-- AddForeignKey
ALTER TABLE "game_messages" ADD CONSTRAINT "game_messages_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

