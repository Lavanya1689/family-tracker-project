import { supabaseAdmin } from "./supabase";
import { parseIcsFeed } from "./ics";
import { icsProvenance } from "./provenance";
import { markLastRun } from "./settings";

export interface IcsIngestResult {
  feedsProcessed: number;
  itemsUpserted: number;
}

// Refetches every registered ics_feeds row and upserts each VEVENT as an
// item, keyed on (feed, uid) so re-running never creates duplicates.
export async function ingestIcsFeeds(): Promise<IcsIngestResult> {
  const db = supabaseAdmin();
  const result: IcsIngestResult = { feedsProcessed: 0, itemsUpserted: 0 };

  const { data: feeds, error } = await db.from("ics_feeds").select("*");
  if (error) throw error;

  for (const feed of feeds ?? []) {
    const events = await parseIcsFeed(feed.url);
    const provenance = icsProvenance(feed.name);

    const rows = events.map((event) => ({
      kind: "event" as const,
      title: event.title,
      description: event.description,
      kid_id: feed.kid_id,
      starts_at: event.startsAt.toISOString(),
      ends_at: event.endsAt ? event.endsAt.toISOString() : null,
      all_day: event.allDay,
      status: "scheduled" as const,
      source_type: "ics" as const,
      ics_feed_id: feed.id,
      ics_uid: event.uid,
      provenance_label: provenance,
    }));

    if (rows.length > 0) {
      const { error: upsertError } = await db
        .from("items")
        .upsert(rows, { onConflict: "ics_feed_id,ics_uid" });
      if (upsertError) throw upsertError;
    }

    await db
      .from("ics_feeds")
      .update({ last_fetched_at: new Date().toISOString() })
      .eq("id", feed.id);

    result.feedsProcessed++;
    result.itemsUpserted += rows.length;
  }

  await markLastRun("last_ics_sync_at");
  return result;
}
