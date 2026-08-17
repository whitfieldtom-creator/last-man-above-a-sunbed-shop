"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FixtureRow = { predictorFixtureId: number; homeTeam: string; awayTeam: string };
type Score = { homeScore: number; awayScore: number };

export default function PredictorPickForm({
  fixtures,
  existingPicks,
  deadlineIso,
}: {
  fixtures: FixtureRow[];
  existingPicks: Record<number, Score>;
  deadlineIso: string;
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<number, { home: string; away: string }>>(
    Object.fromEntries(
      fixtures.map((f) => {
        const existing = existingPicks[f.predictorFixtureId];
        return [f.predictorFixtureId, { home: existing ? String(existing.homeScore) : "", away: existing ? String(existing.awayScore) : "" }];
      })
    )
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const deadlinePassed = new Date() > new Date(deadlineIso);

  function setScore(id: number, side: "home" | "away", value: string) {
    if (deadlinePassed) return;
    setScores((prev) => ({ ...prev, [id]: { ...prev[id], [side]: value } }));
  }

  async function submit() {
    setError(null);

    const picks = fixtures
      .map((f) => {
        const s = scores[f.predictorFixtureId];
        if (s.home === "" || s.away === "") return null;
        return { predictorFixtureId: f.predictorFixtureId, homeScore: Number(s.home), awayScore: Number(s.away) };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    if (picks.length === 0) {
      setError("Enter at least one score before continuing.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/picks/predictor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ picks }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Couldn't save predictions — try again.");
      return;
    }
    router.push("/results");
  }

  return (
    <div>
      {deadlinePassed && <p style={{ color: "crimson" }}>Pick deadline has passed for this week.</p>}
      {fixtures.length === 0 && <p>No Predictor fixtures this week.</p>}

      {fixtures.map((fixture) => {
        const value = scores[fixture.predictorFixtureId];
        return (
          <div key={fixture.predictorFixtureId} style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0.5rem 0" }}>
            <span style={{ flex: 1 }}>{fixture.homeTeam}</span>
            <input
              type="number"
              min={0}
              disabled={deadlinePassed}
              value={value.home}
              onChange={(e) => setScore(fixture.predictorFixtureId, "home", e.target.value)}
              style={{ width: "3rem" }}
            />
            <span>–</span>
            <input
              type="number"
              min={0}
              disabled={deadlinePassed}
              value={value.away}
              onChange={(e) => setScore(fixture.predictorFixtureId, "away", e.target.value)}
              style={{ width: "3rem" }}
            />
            <span style={{ flex: 1 }}>{fixture.awayTeam}</span>
          </div>
        );
      })}

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <button type="button" onClick={submit} disabled={submitting || deadlinePassed}>
        {submitting ? "Saving…" : "Next"}
      </button>
    </div>
  );
}
