"use client";

import { CheckCircle2, Frown, Meh, Smile } from "lucide-react";
import { useState, useTransition } from "react";

import { submitFeedbackAction } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import type { FeedbackRating } from "@/lib/schemas/order";
import type { TrackerSnapshot } from "@/lib/orders/tracker";

const RATINGS: Array<{
  value: FeedbackRating;
  label: string;
  icon: typeof Smile;
}> = [
  { value: "GREAT", label: "Great", icon: Smile },
  { value: "OKAY", label: "Okay", icon: Meh },
  { value: "BAD", label: "Not great", icon: Frown },
];

const RATING_COPY: Record<FeedbackRating, string> = {
  GREAT: "Great",
  OKAY: "Okay",
  BAD: "Not great",
};

export function TrackerFeedback({ snapshot }: { snapshot: TrackerSnapshot }) {
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState<FeedbackRating | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (snapshot.status !== "DELIVERED") return null;

  const saved = submitted ?? snapshot.feedback?.rating ?? null;
  if (saved) {
    return (
      <section
        aria-labelledby="feedback-heading"
        className="flex flex-col gap-2 rounded-2xl border border-green-100 bg-surface p-5 shadow-card"
      >
        <h2
          id="feedback-heading"
          className="flex items-center gap-2 text-lg font-extrabold text-green-800"
        >
          <CheckCircle2 aria-hidden="true" className="size-5" />
          Thanks for your feedback
        </h2>
        <p className="text-sm text-ink-secondary">
          You rated this order “{RATING_COPY[saved]}”.
          {snapshot.feedback?.notes
            ? ` Your note: ${snapshot.feedback.notes}`
            : ""}
        </p>
      </section>
    );
  }

  if (!snapshot.canRate) return null;

  function send(rating: FeedbackRating) {
    setError(null);
    startTransition(async () => {
      const result = await submitFeedbackAction({
        orderToken: snapshot.orderToken,
        rating,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSubmitted(rating);
    });
  }

  return (
    <section
      aria-labelledby="feedback-heading"
      className="flex flex-col gap-3 rounded-2xl border border-green-100 bg-surface p-5 shadow-card"
    >
      <div className="flex flex-col gap-1">
        <h2 id="feedback-heading" className="text-lg font-extrabold text-green-800">
          How was your order?
        </h2>
        <p className="text-sm text-ink-secondary">
          One tap is enough. Feedback can be sent once.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {RATINGS.map((rating) => {
          const Icon = rating.icon;
          return (
            <Button
              key={rating.value}
              variant="secondary"
              size="lg"
              fullWidth
              disabled={pending}
              leadingIcon={<Icon aria-hidden="true" className="size-5" />}
              onClick={() => send(rating.value)}
            >
              {rating.label}
            </Button>
          );
        })}
      </div>

      <label className="flex flex-col gap-1 text-sm font-semibold text-green-900">
        Add a note (optional)
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={1000}
          rows={2}
          className="min-h-touch rounded-xl border border-green-200 bg-surface px-3 py-2 text-base font-normal text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
          placeholder="Anything the kitchen or rider should know?"
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm font-semibold text-status-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
