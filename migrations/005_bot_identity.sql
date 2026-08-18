-- Maps a Slack account to a member of staff, so the bot can apply the same
-- access rules as the admin panel instead of answering everyone identically.
--
-- The mapping is discovered rather than maintained: Slack already holds each
-- user's verified email, so the bot matches that against it_staff.email the
-- first time someone asks it something, and remembers the result. Nobody has
-- to look up Slack user IDs by hand.

ALTER TABLE it_staff ADD COLUMN IF NOT EXISTS slack_user_id TEXT;

-- One Slack account per staff record and vice versa. Without this, two people
-- could end up sharing an identity and inherit each other's scope.
CREATE UNIQUE INDEX IF NOT EXISTS idx_it_staff_slack_user_id
  ON it_staff (slack_user_id) WHERE slack_user_id IS NOT NULL;

-- The log column was named for the bot's Telegram origins. Renamed rather than
-- replaced so the existing rows survive.
ALTER TABLE bot_query_log RENAME COLUMN telegram_user_id TO platform_user_id;
ALTER TABLE bot_query_log ALTER COLUMN platform_user_id TYPE TEXT;

-- Who asked, and what scope they were answered under. A log that records the
-- question but not who could see the answer is not much use in an audit.
ALTER TABLE bot_query_log
  ADD COLUMN IF NOT EXISTS staff_id INTEGER REFERENCES it_staff(id),
  ADD COLUMN IF NOT EXISTS scoped_to_branch TEXT,
  ADD COLUMN IF NOT EXISTS refused BOOLEAN NOT NULL DEFAULT false;

GRANT SELECT, UPDATE (slack_user_id) ON it_staff TO visionbot;
GRANT INSERT ON bot_query_log TO visionbot;