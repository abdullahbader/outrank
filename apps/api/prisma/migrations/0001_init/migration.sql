-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'star',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "title_ar" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 2,
    "ranking_basis_en" TEXT,
    "ranking_basis_ar" TEXT,
    "explanation_en" TEXT,
    "explanation_ar" TEXT,
    "as_of" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "verification" TEXT NOT NULL DEFAULT 'unverified',
    "last_verified_at" TIMESTAMP(3),
    "dataset" TEXT NOT NULL DEFAULT 'TEST',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_answers" (
    "question_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "text_en" TEXT NOT NULL,
    "text_ar" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "value_note" TEXT,

    CONSTRAINT "question_answers_pkey" PRIMARY KEY ("question_id","rank")
);

-- CreateTable
CREATE TABLE "question_sources" (
    "id" SERIAL NOT NULL,
    "question_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT,
    "accessed_at" TEXT,

    CONSTRAINT "question_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar_color" TEXT,
    "locale" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "host_device_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'lobby',
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "state" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "host_recovery_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_participants" (
    "game_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMP(3),

    CONSTRAINT "game_participants_pkey" PRIMARY KEY ("game_id","player_id")
);

-- CreateTable
CREATE TABLE "game_questions" (
    "game_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "question_id" TEXT NOT NULL,

    CONSTRAINT "game_questions_pkey" PRIMARY KEY ("game_id","position")
);

-- CreateTable
CREATE TABLE "game_events" (
    "game_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_events_pkey" PRIMARY KEY ("game_id","seq")
);

-- CreateTable
CREATE TABLE "game_actions" (
    "game_id" TEXT NOT NULL,
    "client_action_id" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_actions_pkey" PRIMARY KEY ("game_id","client_action_id")
);

-- CreateTable
CREATE TABLE "game_results" (
    "game_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "final_rank" INTEGER NOT NULL,
    "final_score" INTEGER NOT NULL,
    "won" BOOLEAN NOT NULL,
    "answers_claimed" INTEGER NOT NULL,
    "points_gained" INTEGER NOT NULL,
    "points_lost" INTEGER NOT NULL,
    "cards_used" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_results_pkey" PRIMARY KEY ("game_id","device_id")
);

-- CreateIndex
CREATE INDEX "questions_category_id_status_verification_idx" ON "questions"("category_id", "status", "verification");

-- CreateIndex
CREATE INDEX "question_sources_question_id_idx" ON "question_sources"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "devices_token_hash_key" ON "devices"("token_hash");

-- CreateIndex
CREATE INDEX "games_code_idx" ON "games"("code");

-- CreateIndex
CREATE INDEX "game_participants_device_id_idx" ON "game_participants"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_questions_game_id_question_id_key" ON "game_questions"("game_id", "question_id");

-- CreateIndex
CREATE INDEX "game_results_device_id_idx" ON "game_results"("device_id");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_sources" ADD CONSTRAINT "question_sources_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_host_device_id_fkey" FOREIGN KEY ("host_device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_participants" ADD CONSTRAINT "game_participants_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_participants" ADD CONSTRAINT "game_participants_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_questions" ADD CONSTRAINT "game_questions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_actions" ADD CONSTRAINT "game_actions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Hand-written constraints Prisma cannot express
ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_rank_check" CHECK ("rank" BETWEEN 1 AND 12);
CREATE UNIQUE INDEX "games_open_code_key" ON "games" ("code") WHERE "status" IN ('lobby', 'playing');
CREATE UNIQUE INDEX "game_participants_device_active_key" ON "game_participants" ("game_id", "device_id") WHERE "removed_at" IS NULL;
CREATE UNIQUE INDEX "game_participants_name_active_key" ON "game_participants" ("game_id", lower("display_name")) WHERE "removed_at" IS NULL;
