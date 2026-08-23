import { Deck, Slide, Appear, BigStat, MiniBarChart } from '../components/deck/Deck';

const NAVY = '#0f1830';
const TEAL = '#008080';
const GOLD = '#d7c770';

/**
 * Pilot deck — "The Travels of a T-Shirt in the Global Economy" (Pietra Rivoli).
 * Format: hook -> the book's claim -> a data check -> the verdict. Positive
 * economics only (what is / why, mechanistically) — no policy verdicts.
 *
 * The data-check slide currently uses figures embedded in the deck. To make it
 * live later, swap <MiniBarChart data=...> for a component that fetches from the
 * observations API (see the note in registry.ts).
 */
export default function TShirtDeck() {
  return (
    <Deck accent={GOLD} background={NAVY}>
      {/* 1 — Hook */}
      <Slide>
        <div style={{ fontSize: 'clamp(13px,1.8vw,18px)', letterSpacing: '0.2em', color: TEAL, marginBottom: 16 }}>
          ROCKOTA · BOOK IN DATA
        </div>
        <h1 style={{ fontSize: 'clamp(34px,6vw,72px)', fontWeight: 800, lineHeight: 1.05, margin: 0 }}>
          Your T-shirt crossed the ocean<br />more times than you have.
        </h1>
        <p style={{ fontSize: 'clamp(16px,2.4vw,26px)', color: 'rgba(255,255,255,0.7)', marginTop: 24 }}>
          <em>The Travels of a T-Shirt in the Global Economy</em> — Pietra Rivoli
        </p>
      </Slide>

      {/* 2 — The question */}
      <Slide>
        <h2 style={{ fontSize: 'clamp(26px,4.5vw,52px)', fontWeight: 700, margin: 0 }}>One question drives the whole book:</h2>
        <p style={{ fontSize: 'clamp(20px,3.4vw,40px)', color: GOLD, marginTop: 24, fontWeight: 600 }}>
          Who really made your $5 t-shirt — the free market, or politics?
        </p>
      </Slide>

      {/* 3 — The book's claim */}
      <Slide steps={3} align="left">
        <h2 style={{ fontSize: 'clamp(24px,4vw,44px)', fontWeight: 700, marginBottom: 24 }}>What Rivoli claims</h2>
        <div style={{ fontSize: 'clamp(17px,2.6vw,28px)', lineHeight: 1.5 }}>
          <Appear atStep={1}>
            <p style={{ margin: '0 0 16px' }}>
              <span style={{ color: TEAL, fontWeight: 700 }}>1.</span> The cotton didn't win on a free market — it won on
              subsidies, land, and infrastructure.
            </p>
          </Appear>
          <Appear atStep={2}>
            <p style={{ margin: '0 0 16px' }}>
              <span style={{ color: TEAL, fontWeight: 700 }}>2.</span> The sewing moved wherever labor was cheapest — a
              ladder countries climb and then leave.
            </p>
          </Appear>
          <Appear atStep={3}>
            <p style={{ margin: 0 }}>
              <span style={{ color: TEAL, fontWeight: 700 }}>3.</span> At every step, <strong>politics shaped the market</strong>
              &nbsp;as much as prices did.
            </p>
          </Appear>
        </div>
      </Slide>

      {/* 4 — The data check */}
      <Slide align="left">
        <div style={{ fontSize: 13, letterSpacing: '0.18em', color: TEAL, marginBottom: 8 }}>THE DATA CHECK</div>
        <h2 style={{ fontSize: 'clamp(22px,3.6vw,40px)', fontWeight: 700, margin: '0 0 20px' }}>
          U.S. apparel manufacturing jobs (thousands)
        </h2>
        <MiniBarChart
          accent={TEAL}
          data={[
            { label: '1990', value: 938 },
            { label: '2000', value: 484 },
            { label: '2010', value: 166 },
            { label: '2020', value: 95 },
            { label: '2024', value: 85 },
          ]}
        />
        <p style={{ fontSize: 'clamp(13px,1.8vw,18px)', color: 'rgba(255,255,255,0.55)', marginTop: 12 }}>
          Illustrative figures embedded in the deck — wire to a live Rockota util to auto-update.
        </p>
      </Slide>

      {/* 5 — The number that lands */}
      <Slide>
        <BigStat value="~90%" label="of the U.S. apparel-making workforce, gone since 1990" accent={GOLD} />
        <p style={{ fontSize: 'clamp(16px,2.4vw,26px)', color: 'rgba(255,255,255,0.75)', marginTop: 24 }}>
          The sewing left. The question is what the numbers say about <em>why</em>.
        </p>
      </Slide>

      {/* 6 — The mechanism (positive, not normative) */}
      <Slide steps={2} align="left">
        <h2 style={{ fontSize: 'clamp(24px,4vw,44px)', fontWeight: 700, marginBottom: 24 }}>What the data supports</h2>
        <div style={{ fontSize: 'clamp(17px,2.6vw,28px)', lineHeight: 1.5 }}>
          <Appear atStep={1}>
            <p style={{ margin: '0 0 16px' }}>
              The decline tracks <strong>trade policy and relative wages</strong>, not a simple "free market chose the
              cheapest" story.
            </p>
          </Appear>
          <Appear atStep={2}>
            <p style={{ margin: 0, color: GOLD }}>
              Rivoli's thesis holds up: the t-shirt's path is a map of <strong>protection and policy</strong> as much as price.
            </p>
          </Appear>
        </div>
      </Slide>

      {/* 7 — Close */}
      <Slide>
        <h2 style={{ fontSize: 'clamp(28px,5vw,56px)', fontWeight: 800, margin: 0 }}>The takeaway</h2>
        <p style={{ fontSize: 'clamp(18px,3vw,32px)', color: 'rgba(255,255,255,0.8)', marginTop: 24, maxWidth: 820 }}>
          "Free trade" and "protection" were never a clean fight. Your t-shirt is the receipt.
        </p>
        <p style={{ fontSize: 'clamp(13px,1.8vw,18px)', color: TEAL, marginTop: 40, letterSpacing: '0.1em' }}>
          ROCKOTA · economics, in service
        </p>
      </Slide>
    </Deck>
  );
}
