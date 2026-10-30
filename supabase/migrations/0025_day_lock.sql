-- Hanh's Log's own database, part 25: a lock on each day of a trip (session 16,
-- Hanh, approved mockup). On a phone held sideways (or a tablet) the site uses
-- the computer layout, where a finger on a block moves it, so a scroll could
-- move a place or activity by mistake. A locked day's blocks can't be moved or
-- resized; a tap still opens them. The lock is one setting per day, shared by
-- everyone on the trip, and every day starts locked: existing days too (the
-- default fills them in). Anyone on the trip can unlock a day to rearrange it.
-- Nothing else changes: the days' existing rule (people on a trip use its
-- days) already covers reading and changing this column.

alter table public.itinerary_days
  add column if not exists locked boolean not null default true;
