ALTER TABLE "chapters" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "chapters" ADD COLUMN "prerequisites" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "chapters" ADD COLUMN "source_keys" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "chapters" ADD COLUMN "material_keys" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "bibliography" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "official_source_keys" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "frameworks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "exam_skills" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "materials" jsonb DEFAULT '[]'::jsonb NOT NULL;