"use client";

export default function Error({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">NINOX DATA MAPPER / TECHNICAL CATALOG</div>
          <h1>Relationship Explorer</h1>
          <p className="subhead">The local catalog could not be rendered.</p>
        </div>
      </header>
      <div className="catalog-alert error" role="alert">
        <strong>Explorer failed to load.</strong> Missing or unreadable local artifacts should not crash this page. Retry after a scan, or inspect output/schema.json and output/relationships.json.
      </div>
      <button className="catalog-submit" type="button" onClick={() => retry()}>Try again</button>
    </main>
  );
}
