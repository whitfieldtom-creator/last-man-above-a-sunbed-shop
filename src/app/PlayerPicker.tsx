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
      <div className="stack">
        {players.map((player) => (
          <button key={player.id} className="btn player-btn" onClick={() => setSelected(player)}>
            {player.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={submitPasscode} className="panel stack">
      <div>
        <p className="eyebrow">Playing as</p>
        <p className="row">
          <span style={{ fontSize: "1.2rem" }}>{selected.name}</span>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setSelected(null);
              setError(null);
            }}
          >
            not you?
          </button>
        </p>
      </div>
      <input
        type="password"
        autoFocus
        className="input"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        placeholder="Passcode"
      />
      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? "Checking…" : "Go"}
      </button>
      {error && <p className="text-danger">{error}</p>}
    </form>
  );
}
