-- Rates are now stored as the HOURLY figure, whatever period the hire was
-- arranged over. rateType stops being a divisor and becomes a plain term of
-- the agreement.
--
-- What is already stored is a daily, weekly or monthly total, so it is divided
-- by the hours in that period — 10, 60 or 260 — which is exactly what billing
-- used to do at invoice time. ROUND reproduces the halala rounding that turned
-- a monthly 16,000 into 61.54 an hour, so rates come out of this unchanged in
-- what they actually charge.
--
-- Invoice line items are deliberately left alone. An issued invoice is a
-- record of what was claimed on a date, not a live view, and its unitRate was
-- already the hourly figure.

-- Cross-hire first: it reads the arrangement off the contract's earliest
-- assignment, which the next statement does not alter.
UPDATE "Contract" c
SET "crossHireRate" = ROUND(
  c."crossHireRate"::numeric / COALESCE((
    SELECT CASE ea."rateType"
             WHEN 'PER_MONTH' THEN 260
             WHEN 'PER_WEEK'  THEN 60
             WHEN 'PER_DAY'   THEN 10
             ELSE 1
           END
    FROM "EquipmentAssignment" ea
    WHERE ea."contractId" = c."id"
    ORDER BY ea."startDate" ASC
    LIMIT 1
  ), 1)
)::int
WHERE c."crossHireRate" IS NOT NULL;

UPDATE "EquipmentAssignment"
SET "rateAmount" = ROUND("rateAmount"::numeric / CASE "rateType"
  WHEN 'PER_MONTH' THEN 260
  WHEN 'PER_WEEK'  THEN 60
  WHEN 'PER_DAY'   THEN 10
  ELSE 1
END)::int;

-- PER_HOUR existed only briefly, between making a rate enterable per hour and
-- making every rate hourly. Those amounts were already hourly and the ELSE
-- above left them alone; only the arrangement needs a home, and a machine
-- quoted by the hour is a daily hire.
UPDATE "EquipmentAssignment"
SET "rateType" = 'PER_DAY'
WHERE "rateType" = 'PER_HOUR';
