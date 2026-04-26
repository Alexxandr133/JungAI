-- Allow multiple user accounts for one email (up to limit in app logic).
DROP INDEX IF EXISTS "User_email_key";
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
