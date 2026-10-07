"use client";
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "sans-serif", padding: 32 }}>
        <h1>Menu temporarily unavailable</h1>
        <p>Please try again shortly.</p>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
