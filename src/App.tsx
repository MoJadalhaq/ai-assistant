import { useEffect, useState } from "react";

interface Health {
  ok: boolean;
  today: string;
  roomTypes?: number;
  hint?: string;
}

// Placeholder page for Phase 1. Its only job is to prove that React, Tailwind and the
// Worker API are wired together. The guest chat replaces it in Phase 3.
export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json() as Promise<Health>)
      .then(setHealth)
      .catch(() => setUnreachable(true));
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-slate-800">
      <span className="self-start rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
        Demo, fictional hotel
      </span>
      <h1 className="text-2xl font-semibold">Sahil Demo Hotel, Jeddah</h1>
      <p className="text-slate-600">AI receptionist. The chat arrives in Phase 3; this page checks the setup.</p>
      <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">{describe(health, unreachable)}</p>
    </main>
  );
}

function describe(health: Health | null, unreachable: boolean): string {
  if (unreachable) return "The API did not answer.";
  if (!health) return "Checking the API…";
  if (!health.ok) return `The API answered, but the database is not ready. ${health.hint ?? ""}`;
  return `API and database are up. Today in Riyadh: ${health.today}. Room types: ${health.roomTypes}.`;
}
