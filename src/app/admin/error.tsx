"use client";
export default function ErrorView({ reset }: { reset: () => void }) {
  return (
    <div className="admin-card">
      <h1>Unable to load the CMS</h1>
      <p>Please check the database connection and try again.</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
