import Link from "next/link";

const PLAYERS = ["Tom", "Goods", "Kev", "Rich", "Ed", "Martin"];

export default function ChoosePlayerPage() {
  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Last Man Above A Sunbed Shop</h1>
      <p>Choose your player</p>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {PLAYERS.map((name) => (
          <li key={name} style={{ margin: "0.5rem 0" }}>
            <Link href={`/lms?player=${encodeURIComponent(name)}`}>{name}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
