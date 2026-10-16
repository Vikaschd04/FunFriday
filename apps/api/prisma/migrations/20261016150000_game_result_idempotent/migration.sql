-- One result per game run: lets the API re-apply the "game finished" effect safely after a crash
-- (INSERT ... ON CONFLICT DO NOTHING). Rollback (local): DROP INDEX "game_results_session_id_started_at_key";
CREATE UNIQUE INDEX "game_results_session_id_started_at_key" ON "game_results"("session_id", "started_at");
