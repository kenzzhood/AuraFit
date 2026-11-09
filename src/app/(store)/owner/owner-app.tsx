"use client";

import { useEffect, useState } from "react";

type Row = {
  styleId: string;
  shown: number;
  opened: number;
  tryOn: number;
  saved: number;
  staffCalled: number;
  sold: number;
  attribution: string;
};

export function OwnerApp() {
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    const me = await fetch("/api/auth/session").then((response) => response.json());
    setRole(me.role ?? null);
    if (me.role !== "owner" && me.role !== "admin") return;
    const report = await fetch("/api/owner/report");
    if (!report.ok) return;
    const body = await report.json();
    setRows(body.report);
  }

  useEffect(() => {
    void load();
  }, []);

  async function signIn() {
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "owner" }),
    });
    await load();
  }

  if (role === undefined) {
    return (
      <main className="sheet">
        <p className="brand">AuraFit</p>
      </main>
    );
  }

  if (role !== "owner" && role !== "admin") {
    return (
      <main className="sheet">
        <h1>Tried, not bought</h1>
        <p className="lead">The owner report for this store.</p>
        <button type="button" className="table-button" onClick={() => void signIn()}>
          Continue
        </button>
      </main>
    );
  }

  return (
    <main className="sheet">
      <header>
        <p className="brand">AuraFit · Kasavu & Co</p>
        <a className="text-button" href="/admin">
          Stores
        </a>
      </header>
      <h1>Tried, not bought</h1>
      <p className="lead">Opens and try-ons against barcode-matched sales. Counts only.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Style</th>
              <th>Opened</th>
              <th>Try-on</th>
              <th>Saved</th>
              <th>Staff</th>
              <th>Sold</th>
              <th>Match</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.styleId}>
                <td>{row.styleId}</td>
                <td>{row.opened}</td>
                <td>{row.tryOn}</td>
                <td>{row.saved}</td>
                <td>{row.staffCalled}</td>
                <td>{row.sold}</td>
                <td>{row.attribution}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
