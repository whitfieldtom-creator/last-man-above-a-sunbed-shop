"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Fixture = { id: number; homeTeam: string; awayTeam: string; kickoffTime: string };
type LeagueGroup = { leagueId: number; leagueName: string; fixtures: Fixture[] };
type Selection = { fixtureId: number; teamPicked: string };

export default function LmsPickForm({
  leagueGroups,
  existingPicks,
  usedTeamsByLeague,
  deadlineIso,
}: {
  leagueGroups: LeagueGroup[];
  existingPicks: Record<number, Selection>;
  usedTeamsByLeague: Record<number, string[]>;
  deadlineIso: string;
}) {
  const router = useRouter();
  const [selections, setSelections] = useState<Record<number, Selection>>(existingPicks);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showStokeWarning, setShowStokeWarning] = useState(false);

  const readOnly = new Date() > new Date(deadlineIso);

  // True when there's no team the player is allowed to pick anywhere (every
  // team playing in their remaining leagues has already been used this run).
  // They can't submit anything, and — per the rules — will lose those lives
  // at settlement, but they still need a way on to the Score Predictor.
  const nothingPickable = leagueGroups.every((group) => {
    const used = new Set(usedTeamsByLeague[group.leagueId] ?? []);
    return group.fixtures.every((f) => used.has(f.homeTeam) && used.has(f.awayTeam));
  });

  function pickTeam(leagueId: number, fixtureId: number, team: string) {
    if ((usedTeamsByLeague[leagueId] ?? []).includes(team) || readOnly) return;
    setSelections((prev) => ({ ...prev, [leagueId]: { fixtureId, teamPicked: team } }));
    if (team === "Stoke City") setShowStokeWarning(true);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);

    const picks = Object.values(selections);
    const res = await fetch("/api/picks/lms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ picks }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Couldn't save picks — try again.");
      return;
    }
    router.push("/predictor");
  }

  return (
    <div className="stack">
      {readOnly && <p className="eyebrow">Picks locked — here&apos;s what you submitted</p>}
      {leagueGroups.length === 0 && (
        <p className="text-muted">
          None of the leagues you&apos;re still alive in have games this week, so there&apos;s nothing for you to pick.
          You won&apos;t lose a life — you can still play the Score Predictor.
        </p>
      )}
      {leagueGroups.length > 0 && nothingPickable && !readOnly && (
        <p className="text-danger">
          You&apos;ve already used every team playing in the leagues you have left, so there&apos;s no one you can pick.
          You&apos;ll lose those lives when the week settles. You can still play the Score Predictor.
        </p>
      )}

      {leagueGroups.map((group) => {
        const selected = selections[group.leagueId];
        const usedTeamSet = new Set(usedTeamsByLeague[group.leagueId] ?? []);
        return (
          <section key={group.leagueId} className="panel">
            <p className="eyebrow">{group.leagueName}</p>
            <div className="stack">
              {group.fixtures.map((fixture) => {
                const homeSelected = selected?.fixtureId === fixture.id && selected.teamPicked === fixture.homeTeam;
                const awaySelected = selected?.fixtureId === fixture.id && selected.teamPicked === fixture.awayTeam;
                const homeUsed = usedTeamSet.has(fixture.homeTeam);
                const awayUsed = usedTeamSet.has(fixture.awayTeam);
                return (
                  <div key={fixture.id} className="row">
                    <button
                      type="button"
                      disabled={homeUsed || readOnly}
                      onClick={() => pickTeam(group.leagueId, fixture.id, fixture.homeTeam)}
                      className={`btn pick-btn${homeSelected ? " pick-btn--selected" : ""}${homeUsed ? " pick-btn--used" : ""}`}
                      style={{ flex: 1 }}
                    >
                      {fixture.homeTeam}
                    </button>
                    <span className="text-faint">v</span>
                    <button
                      type="button"
                      disabled={awayUsed || readOnly}
                      onClick={() => pickTeam(group.leagueId, fixture.id, fixture.awayTeam)}
                      className={`btn pick-btn${awaySelected ? " pick-btn--selected" : ""}${awayUsed ? " pick-btn--used" : ""}`}
                      style={{ flex: 1 }}
                    >
                      {fixture.awayTeam}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {error && <p className="text-danger">{error}</p>}

      {readOnly || nothingPickable ? (
        <Link href="/predictor" className="btn btn-primary">
          Next
        </Link>
      ) : (
        <button type="button" className="btn btn-primary" onClick={submit} disabled={submitting}>
          {submitting ? "Saving…" : "Next"}
        </button>
      )}

      {showStokeWarning && (
        <div className="modal-overlay" onClick={() => setShowStokeWarning(false)}>
          <div className="modal-box modal-box--danger" onClick={(e) => e.stopPropagation()}>
            <p className="text-danger" style={{ fontWeight: 700 }}>
              WARNING — YOU ARE CHOOSING STOKE CITY TO WIN — IS THIS AN ERROR?
            </p>
            <button type="button" className="btn" onClick={() => setShowStokeWarning(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
