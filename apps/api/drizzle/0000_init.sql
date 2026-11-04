CREATE TYPE "public"."media_kind" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."poi_category" AS ENUM('furniture', 'door', 'window', 'stairs', 'elevator', 'restroom', 'exit', 'appliance', 'landmark', 'other');--> statement-breakpoint
CREATE TYPE "public"."poi_source" AS ENUM('manual', 'ai_detected');--> statement-breakpoint
CREATE TYPE "public"."reconstruction_status" AS ENUM('queued', 'processing', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."space_type" AS ENUM('room', 'floor', 'building', 'outdoor_area', 'other');--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"kind" "media_kind" NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "points_of_interest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"category" "poi_category" NOT NULL,
	"source" "poi_source" DEFAULT 'manual' NOT NULL,
	"position_x" double precision NOT NULL,
	"position_y" double precision NOT NULL,
	"position_z" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconstruction_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"provider" varchar(64) NOT NULL,
	"status" "reconstruction_status" DEFAULT 'queued' NOT NULL,
	"external_job_id" varchar(255),
	"input_media_ids" jsonb NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"space_type" "space_type" DEFAULT 'room' NOT NULL,
	"floor_level" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_of_interest" ADD CONSTRAINT "points_of_interest_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconstruction_jobs" ADD CONSTRAINT "reconstruction_jobs_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_assets_space_id_idx" ON "media_assets" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "poi_space_id_idx" ON "points_of_interest" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "poi_name_lower_idx" ON "points_of_interest" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "reconstruction_jobs_space_id_idx" ON "reconstruction_jobs" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "spaces_project_id_idx" ON "spaces" USING btree ("project_id");