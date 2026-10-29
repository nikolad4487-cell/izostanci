-- Osobni podaci dostupni su samo poslužitelju; ne izlažite shemu u Supabase Data API-ju.
REVOKE ALL ON SCHEMA "dolaznost" FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA "dolaznost" FROM PUBLIC;
ALTER TABLE "dolaznost"."AcademicYear" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dolaznost"."Semester" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dolaznost"."Holiday" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dolaznost"."Course" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dolaznost"."TeachingGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dolaznost"."AttendanceRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dolaznost"."WeeklySlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dolaznost"."Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dolaznost"."AttendanceUnit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dolaznost"."Attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dolaznost"."UserSettings" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA "dolaznost" FROM anon';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA "dolaznost" FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA "dolaznost" FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA "dolaznost" FROM authenticated';
  END IF;
END $$;
