"use client";

import { useEffect, useState } from "react";

type Look = { id: string; name: string; availability: string; image?: string };

export function CatalogueApp() {
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const [looks, setLooks] = useState<Look[]>([]);
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    const me = await fetch("/api/auth/session").then((response) => response.json());
    setRole(me.role ?? null);
    if (me.role !== "admin") return;
    const response = await fetch("/api/admin/catalogue");
    if (!response.ok) return;
    const body = await response.json();
    setLooks(body.looks);
  }

  useEffect(() => {
    void load();
  }, []);

  async function signIn() {
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    });
    await load();
  }

  async function setAvailability(id: string, availability: string) {
    const response = await fetch("/api/admin/catalogue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, availability }),
    });
    setNote(response.ok ? `${id} is now ${availability.replace("_", " ")}.` : "That edit did not save.");
    await load();
  }

  if (role === undefined) {
    return (
      <main className="sheet">
        <p className="brand">AuraFit</p>
      </main>
    );
  }

  if (role !== "admin") {
    return (
      <main className="sheet">
        <h1>Catalogue</h1>
        <button type="button" className="table-button" onClick={() => void signIn()}>
          Continue as admin
        </button>
      </main>
    );
  }

  return (
    <main className="sheet">
      <p className="brand">AuraFit</p>
      <h1>Catalogue</h1>
      <p className="lead">{looks.length} styles. Labels only. No quantities on the floor.</p>
      {note ? <p className="lead">{note}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Style</th>
              <th>Label</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {looks.slice(0, 12).map((look) => (
              <tr key={look.id}>
                <td>{look.name}</td>
                <td>{look.availability.replace("_", " ")}</td>
                <td>
                  <button type="button" className="table-button" onClick={() => void setAvailability(look.id, "ask_staff")}>
                    Ask staff
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
