-- Re-open the 2ml sample tier as an ordinary sellable size (client decision,
-- docs/analysis/questions.md №1: "2ml нь худалдан авалтын энгийн нэмэлт
-- сонголт"). 0027 had closed the size list to 5/10/20; the list is now
-- 2/5/10/20 — still a closed set, matching ML_SIZES in src/lib/constants.ts.
-- Bundles keep pricing over 5/10/20 only (BUNDLE_ML_SIZES); that rule lives in
-- application code because collection member prices are derived per size, not
-- constrained here.

alter table product_variants
  drop constraint if exists product_variants_ml_check;
alter table product_variants
  add constraint product_variants_ml_check check (ml in (2, 5, 10, 20));
