import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const styles = pgTable("styles", {
  id: text("id").primaryKey(),
  availability: text("availability").notNull(),
});

export const sessionEvents = pgTable("session_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  type: text("type").notNull(),
  styleId: text("style_id").notNull(),
  sessionId: text("session_id").notNull(),
  at: text("at").notNull(),
});

export const MIGRATION_SQL = `
create table if not exists styles (
  id text primary key,
  availability text not null
);
create table if not exists session_events (
  id integer generated always as identity primary key,
  type text not null,
  style_id text not null,
  session_id text not null,
  at text not null
);
`;
