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
  usedTeams,
  deadlineIso,
}: {
  leagueGroups: LeagueGroup[];
  existingPicks: Record<number, Selection>;
  usedTeams: string[];
  deadlineIso: string;
}) {
  const router = useRouter();
  const [selections, setSelections] = useState<Record<number, Selection>>(existingPicks);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const usedTeamSet = new Set(usedTeams);
  const readOnly = new Date() > new Date(deadlineIso);

  function pickTeam(leagueId: number, fixtureId: number, team: string) {
    if (usedTeamSet.has(team) || readOnly) return;
    setSelections((prev) => ({ ...prev, [leagueId]: { fixtureId, teamPicked: team } }));
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
      {leagueGroups.length === 0 && <p className="text-muted">No fixtures this week.</p>}

      {leagueGroups.map((group) => {
        const selected = selections[group.leagueId];
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

      {readOnly ? (
        <Link href="/predictor" className="btn btn-primary">
          Next
        </Link>
      ) : (
        <button type="button" className="btn btn-primary" onClick={submit} disabled={submitting}>
          {submitting ? "Saving…" : "Next"}
        </button>
      )}
    </div>
  );
}
