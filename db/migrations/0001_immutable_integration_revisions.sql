CREATE FUNCTION velocity_editor.prevent_revision_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Integration revisions are immutable';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER integration_revisions_immutable BEFORE UPDATE OR DELETE ON velocity_editor.integration_revisions
FOR EACH ROW EXECUTE FUNCTION velocity_editor.prevent_revision_change();
