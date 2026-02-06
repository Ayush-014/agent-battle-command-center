-- Migration: Simplify Task Complexity Model
-- Handles both fresh databases and migrations from old schema

BEGIN;

-- Step 1: Add new columns (if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'complexity') THEN
        ALTER TABLE tasks ADD COLUMN complexity DOUBLE PRECISION;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'complexity_source') THEN
        ALTER TABLE tasks ADD COLUMN complexity_source VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'complexity_reasoning') THEN
        ALTER TABLE tasks ADD COLUMN complexity_reasoning TEXT;
    END IF;
END $$;

-- Step 2: Migrate data from old columns (only if they exist)
DO $$
BEGIN
    -- Check if old columns exist before trying to migrate
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name IN ('router_complexity', 'haiku_complexity', 'final_complexity', 'actual_complexity')) THEN
        UPDATE tasks SET
            complexity = COALESCE(final_complexity, actual_complexity, haiku_complexity, router_complexity),
            complexity_source = CASE
                WHEN final_complexity IS NOT NULL AND haiku_complexity IS NOT NULL THEN 'dual'
                WHEN actual_complexity IS NOT NULL THEN 'actual'
                WHEN haiku_complexity IS NOT NULL THEN 'haiku'
                WHEN router_complexity IS NOT NULL THEN 'router'
                ELSE NULL
            END,
            complexity_reasoning = haiku_reasoning
        WHERE complexity IS NULL;

        RAISE NOTICE 'Migrated complexity data from old columns';
    ELSE
        RAISE NOTICE 'Old complexity columns not found, skipping data migration (fresh database)';
    END IF;
END $$;

COMMIT;
