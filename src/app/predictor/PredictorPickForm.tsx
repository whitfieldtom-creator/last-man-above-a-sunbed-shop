"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BonusBanner from "../BonusBanner";
import DerbyNotice from "../DerbyNotice";
import { predictsDerbyWin } from "@/lib/bonus";

type FixtureRow = { predictorFixtureId: number; homeTeam: string; awayTeam: string; isBonus: boolean };
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
  const [showDerbyNotice, setShowDerbyNotice] = useState(false);
  // Fixtures the Derby notice has already fired for, so it doesn't nag on every keystroke.
  const [derbyShownFor, setDerbyShownFor] = useState<Set<number>>(new Set());

  const readOnly = new Date() > new Date(deadlineIso);

  function setScore(id: number, side: "home" | "away", value: string) {
    if (readOnly) return;
    const next = { ...scores[id], [side]: value };
    setScores((prev) => ({ ...prev, [id]: next }));

    // Easter egg: scoreline has Derby winning.
    const fixture = fixtures.find((x) => x.predictorFixtureId === id);
    if (fixture && next.home !== "" && next.away !== "" && !derbyShownFor.has(id) && predictsDerbyWin(fixture, Number(next.home), Number(next.away))) {
      setDerbyShownFor((prev) => new Set(prev).add(id));
      setShowDerbyNotice(true);
    }
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
    router.push("/menu");
  }

  return (
    <div className="stack">
      {readOnly && <p className="eyebrow">Picks locked — here&apos;s what you submitted</p>}
      {fixtures.length === 0 && <p className="text-muted">No Predictor fixtures this week.</p>}

      <div className="panel stack">
        {fixtures.map((fixture) => {
          const value = scores[fixture.predictorFixtureId];
          const row = (
            <div className="row">
              <span style={{ flex: 1, textAlign: "right" }}>{fixture.homeTeam}</span>
              <input
                type="number"
                min={0}
                disabled={readOnly}
                value={value.home}
                onChange={(e) => setScore(fixture.predictorFixtureId, "home", e.target.value)}
                className="input input--score"
              />
              <span className="text-faint">–</span>
              <input
                type="number"
                min={0}
                disabled={readOnly}
                value={value.away}
                onChange={(e) => setScore(fixture.predictorFixtureId, "away", e.target.value)}
                className="input input--score"
              />
              <span style={{ flex: 1 }}>{fixture.awayTeam}</span>
            </div>
          );
          return fixture.isBonus ? (
            <div key={fixture.predictorFixtureId} className="bonus-block">
              <BonusBanner />
              {row}
            </div>
          ) : (
            <div key={fixture.predictorFixtureId}>{row}</div>
          );
        })}
      </div>

      {error && <p className="text-danger">{error}</p>}

      {readOnly ? (
        <Link href="/results" className="btn btn-primary">
          Back to leaderboard
        </Link>
      ) : (
        <button type="button" className="btn btn-primary" onClick={submit} disabled={submitting}>
          {submitting ? "Saving…" : "Next"}
        </button>
      )}

      {showDerbyNotice && <DerbyNotice onClose={() => setShowDerbyNotice(false)} />}
    </div>
  );
}
