-- Full-text search across documents, concepts and notes ('simple' config: the corpus mixes French, English and Spanish).
CREATE INDEX IF NOT EXISTS documents_fts_idx ON documents USING gin (to_tsvector('simple', coalesce(filename,'') || ' ' || coalesce(text,'')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS concepts_fts_idx ON concepts USING gin (to_tsvector('simple', coalesce(term,'') || ' ' || coalesce(definition,'')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS notes_fts_idx ON notes USING gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(body,'')));
