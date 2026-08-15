-- B1: operator 3rd party certificates now use their own two-value list
-- (Assessment | TPC/QE) instead of the equipment-oriented one. The single
-- existing row used 'Operator Competency' with QATAR_ENERGY already in its
-- approvedFor — under the new model only TPC/QE unlocks QatarEnergy
-- eligibility (see B3), so that is the faithful mapping, not a default.
UPDATE "Document" SET "thirdPartyType" = 'TPC/QE'
  WHERE "ownerType" = 'OPERATOR' AND "thirdPartyType" = 'Operator Competency';
