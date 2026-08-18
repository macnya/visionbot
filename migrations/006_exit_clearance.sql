-- Exit clearance, implementing HR Manual sections 8.10.1 and 8.10.2.
--
-- 8.10.1  "All company assets must be returned on or before the last working
--          day." A formal handover to a P&C representative is required.
--
-- 8.10.2  "The department will indicate if the staff owed the company any asset
--          and will need to indicate the exact value of the asset owed."
--          "Finance will pay final dues less any amount owed by the staff."
--          The process must be initiated "within 3 months after an employee
--          exits the organization."
--
-- The policy already exists and is already mandatory. What it lacks is data:
-- somebody in P&C has to state what a leaver owed and what it was worth, and
-- until now there was no reliable way to answer either question. Grace Kimeu
-- left holding seven assets and nothing in the process caught it.

-- --------------------------------------------------------------- employment
-- The employee table had no notion of anyone leaving, which is the root of the
-- problem: an asset assigned to a departed member of staff looked identical to
-- one assigned to a current member of staff.
ALTER TABLE employee
  ADD COLUMN IF NOT EXISTS employment_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_working_day DATE,
  ADD COLUMN IF NOT EXISTS exit_reason TEXT;

ALTER TABLE employee DROP CONSTRAINT IF EXISTS employee_status_valid;
ALTER TABLE employee ADD CONSTRAINT employee_status_valid
  CHECK (employment_status IN ('active', 'exiting', 'exited'));

CREATE INDEX IF NOT EXISTS idx_employee_not_active
  ON employee (employment_status) WHERE employment_status <> 'active';

-- ---------------------------------------------------------------- clearance
CREATE TABLE IF NOT EXISTS exit_clearance (
  id                  SERIAL PRIMARY KEY,
  employee_id         INTEGER NOT NULL REFERENCES employee(id),

  -- 8.10.1: assets are due back on or before the last working day.
  last_working_day    DATE NOT NULL,

  -- 8.10.2 gives P&C three months to initiate for staff who never came in.
  -- Stored rather than computed so a policy change does not silently move
  -- every historical deadline.
  deadline            DATE NOT NULL,

  status              TEXT NOT NULL DEFAULT 'open',
  reason              TEXT,

  -- 8.10.2 distinguishes an ordinary exit from one involving fraud, where
  -- clearance waits for the investigation to conclude.
  involves_fraud      BOOLEAN NOT NULL DEFAULT false,

  opened_by           INTEGER REFERENCES it_staff(id),
  opened_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_by        INTEGER REFERENCES it_staff(id),
  completed_at        TIMESTAMP,
  notes               TEXT,

  CONSTRAINT clearance_status_valid
    CHECK (status IN ('open', 'complete', 'cancelled')),

  -- One live clearance per person. A second would split the asset list in two
  -- and neither would be the answer.
  CONSTRAINT clearance_deadline_after_exit
    CHECK (deadline >= last_working_day)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_clearance_per_employee
  ON exit_clearance (employee_id) WHERE status = 'open';

-- ------------------------------------------------------------------- items
-- One row per asset the leaver held when clearance opened. The list is frozen
-- at that moment: an asset quietly reassigned afterwards must still appear,
-- or the process could be circumvented by moving things around.
CREATE TABLE IF NOT EXISTS exit_clearance_item (
  id                  SERIAL PRIMARY KEY,
  clearance_id        INTEGER NOT NULL REFERENCES exit_clearance(id) ON DELETE CASCADE,
  asset_id            INTEGER NOT NULL REFERENCES asset(id),

  -- Captured at the time, because 8.10.2 requires "the exact value of the asset
  -- owed" and a later correction to purchase_price must not silently change
  -- what Finance was told to deduct.
  value_at_exit       NUMERIC(14,2),

  outcome             TEXT NOT NULL DEFAULT 'outstanding',
  resolved_by         INTEGER REFERENCES it_staff(id),
  resolved_at         TIMESTAMP,
  notes               TEXT,

  CONSTRAINT item_outcome_valid
    CHECK (outcome IN ('outstanding', 'returned', 'written_off', 'owed')),

  -- An asset appears once per clearance.
  CONSTRAINT item_unique_per_clearance UNIQUE (clearance_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_clearance_item_outstanding
  ON exit_clearance_item (clearance_id) WHERE outcome = 'outstanding';

-- The bot and the panel both read this; neither writes it directly.
GRANT SELECT ON exit_clearance, exit_clearance_item TO visionbot;