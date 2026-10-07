"use client";
export default function MenuError({ reset }: { reset: () => void }) {
  return (
    <main style={{ padding: 32, textAlign: "center" }}>
      <h1>Menu temporarily unavailable</h1>
      <p>Please try again shortly.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
