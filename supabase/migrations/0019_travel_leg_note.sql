-- Hanh's Log's own database, part 19: a note on each travel leg (session 14).
-- Hanh decided every itinerary time block gets a note: activities and places
-- already had a note column (0003, 0005); travel legs get one here. Same
-- limit as the others. No access changes: travel_legs' own rules apply.

alter table public.travel_legs
  add column if not exists note text check (note is null or char_length(note) <= 4000);
