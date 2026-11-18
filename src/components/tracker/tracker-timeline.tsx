import { formatInTimeZone } from "date-fns-tz";
import { Check, Circle, XCircle } from "lucide-react";

import type { TrackerSnapshot } from "@/lib/orders/tracker";

import { TIMELINE_LABEL } from "./tracker-copy";

function formatWhen(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatInTimeZone(date, "Africa/Kampala", "HH:mm");
}

export function TrackerTimeline({ snapshot }: { snapshot: TrackerSnapshot }) {
  const entries =
    snapshot.timeline.length > 0
      ? snapshot.timeline
      : [{ status: snapshot.status, at: snapshot.createdAt ?? "", reason: null }];

  const lastIndex = entries.length - 1;

  return (
    <section
      aria-labelledby="timeline-heading"
      className="flex flex-col gap-3 rounded-2xl border border-green-100 bg-surface p-5 shadow-card"
    >
      <h2 id="timeline-heading" className="text-lg font-extrabold text-green-800">
        Progress
      </h2>
      <ol className="flex flex-col gap-0">
        {entries.map((entry, index) => {
          const failed =
            entry.status === "DELIVERY_FAILED" || entry.status === "CANCELLED";
          const done = index < lastIndex;
          const when = formatWhen(entry.at);
          return (
            <li
              key={`${entry.status}-${entry.at}-${index}`}
              className="relative flex gap-3 pb-4 last:pb-0"
            >
              {index < lastIndex ? (
                <span
                  aria-hidden="true"
                  className="absolute left-[11px] top-6 h-[calc(100%-1rem)] w-0.5 bg-green-200"
                />
              ) : null}
              <span
                aria-hidden="true"
                className={
                  failed
                    ? "z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-status-dangerSurface text-status-danger"
                    : done || index === lastIndex
                      ? "z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-green-800 text-white"
                      : "z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-800"
                }
              >
                {failed ? (
                  <XCircle className="size-4" />
                ) : done || index === lastIndex ? (
                  <Check className="size-4" />
                ) : (
                  <Circle className="size-3" />
                )}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="font-semibold text-green-900">
                  {TIMELINE_LABEL[entry.status]}
                </p>
                {when ? (
                  <p className="text-sm text-ink-secondary">{when} EAT</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
