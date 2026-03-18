-- Phase 5: RLS-Policies fuer alle Tabellen
-- Internes Team-Tool: alle authentifizierten User duerfen alles lesen/schreiben
-- Service-Role-Key umgeht RLS automatisch (fuer n8n/Webhooks)

-- RLS aktivieren
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributions ENABLE ROW LEVEL SECURITY;

-- campaigns
CREATE POLICY "auth_select" ON campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON campaigns FOR UPDATE TO authenticated USING (true);

-- concepts
CREATE POLICY "auth_select" ON concepts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON concepts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON concepts FOR UPDATE TO authenticated USING (true);

-- translations
CREATE POLICY "auth_select" ON translations FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON translations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON translations FOR UPDATE TO authenticated USING (true);

-- assets
CREATE POLICY "auth_select" ON assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON assets FOR UPDATE TO authenticated USING (true);

-- approvals
CREATE POLICY "auth_select" ON approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON approvals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON approvals FOR UPDATE TO authenticated USING (true);

-- audit_log (nur lesen + einfuegen, kein Update)
CREATE POLICY "auth_select" ON audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- distributions
CREATE POLICY "auth_select" ON distributions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON distributions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON distributions FOR UPDATE TO authenticated USING (true);
