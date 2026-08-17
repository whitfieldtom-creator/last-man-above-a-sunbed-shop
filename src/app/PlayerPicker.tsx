"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PlayerPicker({ players }: { players: { id: number; name: string }[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<{ id: number; name: string } | null>(null);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitPasscode(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/select-player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: selected.id, passcode }),
    });

    setSubmitting(false);
    if (!res.ok) {
      setError("Wrong passcode — try again.");
      return;
    }
    router.push("/lms");
  }

  if (!selected) {
    return (
      <ul style={{ listStyle: "none", padding: 0 }}>
        {players.map((player) => (
          <li key={player.id} style={{ margin: "0.5rem 0" }}>
            <button
              onClick={() => setSelected(player)}
              style={{ font: "inherit", cursor: "pointer" }}
            >
              {player.name}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <form onSubmit={submitPasscode}>
      <p>
        {selected.name} —{" "}
        <button type="button" onClick={() => { setSelected(null); setError(null); }}>
          not you?
        </button>
      </p>
      <input
        type="password"
        autoFocus
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        placeholder="Passcode"
      />
      <button type="submit" disabled={submitting}>
        {submitting ? "Checking…" : "Go"}
      </button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </form>
  );
}
