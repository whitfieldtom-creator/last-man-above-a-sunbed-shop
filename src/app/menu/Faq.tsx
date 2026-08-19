const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "How does it work?",
    a: (
      <>
        <p>This game is fully idiot proof. Please follow the prompts.</p>
        <p>
          <strong>Last Man Standing:</strong> For each fixture week / round, select a team you think will win their
          match in each division. If any subsequently fail to win, you lose a life. You have 1 life only for each
          division (4 in total). If a selected team wins, you go again in that league the following week. Each team
          is only available for selection to each player once in any one full Last Man Standing run. The prize pot
          will grow as the game advances, by 4 points a week. Hold on in there to stay in the hunt! Gasp in awe as
          the pot grows! Dare to dream!! Once the game reaches the end of a cycle and a winner is crowned, the
          points in the pot are split as follows — 60% to the winner / 25% to 2nd place / 15% to 3rd (should there
          be joint runners up, the winner still gets 60% and the remainder is split evenly between them).
        </p>
        <p>
          <strong>Score Predictor:</strong> Enter your predictions for five randomly generated games each week. 3
          points will be awarded for an exact score, 1 for a correct result. All players are set the same fixtures
          each week. Follow the live &lsquo;TomTech&rsquo; scoreboard as we go to track your progress!
        </p>
      </>
    ),
  },
  {
    q: "What can I win?",
    a: (
      <p>
        The respect of your peers. Plus cash money baby! Win points by placing as high as possible in the predictor
        league whilst simultaneously showcasing your last man standing skills. Bad at one? It&apos;s ok, win the
        other!
      </p>
    ),
  },
  {
    q: "But what if I end up with NOTHING? Not having that mate.",
    a: (
      <p>
        20% of the final overall prize pot will be split between ALL players. The remaining amount will be
        allocated based on the final overall scoreboard. 1st place = 40% / 2nd place = 25% / 3rd place = 15%.
      </p>
    ),
  },
  {
    q: "What is this prize pot you talk of? How much is it? Is it fixed?",
    a: (
      <p>
        The prize pot starts at £120 but is fully DYNAMIC. With elite guidance from our trusted Chief Investment
        Officer, we will agree 1-2 group bets a week, set with the intention of making us all winners.
      </p>
    ),
  },
  {
    q: "How can I thank the creators of this game?",
    a: (
      <p>
        Tom and Paul are now accepting PayPal donations. An undisclosed portion of this will go towards further
        development of this inaugural version of &lsquo;Last Man Above a Sunbed Shop&rsquo;. Thanks in advance x.
      </p>
    ),
  },
];

export default function Faq() {
  return (
    <section style={{ marginTop: "1.5rem" }}>
      <p className="eyebrow">FAQs</p>
      {FAQS.map(({ q, a }) => (
        <details key={q} className="faq-item">
          <summary>{q}</summary>
          <div className="faq-answer">{a}</div>
        </details>
      ))}
    </section>
  );
}
