"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const deadlinePassed = new Date() > new Date(deadlineIso);

  function pickTeam(leagueId: number, fixtureId: number, team: string) {
    if (usedTeamSet.has(team) || deadlinePassed) return;
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
    <div>
      {deadlinePassed && <p style={{ color: "crimson" }}>Pick deadline has passed for this week.</p>}

      {leagueGroups.length === 0 && <p>No fixtures this week.</p>}

      {leagueGroups.map((group) => {
        const selected = selections[group.leagueId];
        return (
          <section key={group.leagueId} style={{ margin: "1.5rem 0" }}>
            <h2 style={{ fontSize: "1.1rem" }}>{group.leagueName}</h2>
            {group.fixtures.map((fixture) => (
              <div key={fixture.id} style={{ display: "flex", gap: "0.5rem", margin: "0.25rem 0" }}>
                {[fixture.homeTeam, fixture.awayTeam].map((team) => {
                  const isUsed = usedTeamSet.has(team);
                  const isSelected = selected?.fixtureId === fixture.id && selected.teamPicked === team;
                  return (
                    <button
                      key={team}
                      type="button"
                      disabled={isUsed || deadlinePassed}
                      onClick={() => pickTeam(group.leagueId, fixture.id, team)}
                      style={{
                        font: "inherit",
                        cursor: isUsed || deadlinePassed ? "not-allowed" : "pointer",
                        opacity: isUsed ? 0.4 : 1,
                        fontWeight: isSelected ? "bold" : "normal",
                        textDecoration: isSelected ? "underline" : "none",
                      }}
                    >
                      {team}
                    </button>
                  );
                })}
              </div>
            ))}
          </section>
        );
      })}

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <button type="button" onClick={submit} disabled={submitting || deadlinePassed}>
        {submitting ? "Saving…" : "Next"}
      </button>
    </div>
  );
}
