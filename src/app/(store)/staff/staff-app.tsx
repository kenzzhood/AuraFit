"use client";

import { useEffect, useState } from "react";

type Alert = {
  id: string;
  message: string;
  escalation: string;
  acceptedBy?: string;
};

type Checklist = { brand: string; steps: readonly string[] };

export function StaffApp() {
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [checklist, setChecklist] = useState<Checklist[]>([]);
  const [lookId, setLookId] = useState("blue-kurta");
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    const me = await fetch("/api/auth/session").then((response) => response.json());
    setRole(me.role ?? null);
    if (!me.role) return;
    const today = await fetch("/api/staff/today");
    if (!today.ok) {
      setRole(null);
      return;
    }
    const body = await today.json();
    setAlerts(body.alerts);
    setChecklist(body.checklist);
  }

  useEffect(() => {
    void load();
  }, []);

  async function signIn() {
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "staff" }),
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

  if (!role) {
    return (
      <main className="sheet">
        <header>
          <p className="brand">AuraFit</p>
        </header>
        <section className="sign-in">
          <h1>Staff</h1>
          <p className="lead">This floor uses a local session. Microsoft Entra replaces it when the store turns it on.</p>
          <button type="button" className="table-button" onClick={() => void signIn()}>
            Continue
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="sheet">
      <header>
        <p className="brand">AuraFit · Kasavu & Co</p>
        <a className="text-button" href="/owner">
          Tried, not bought
        </a>
      </header>
      <h1>Calls on the floor</h1>
      <p className="lead">A call reaches every phone at one minute, then the manager at two.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Call</th>
              <th>Level</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={3}>No calls right now.</td>
              </tr>
            ) : (
              alerts.map((alert) => (
                <tr key={alert.id}>
                  <td>{alert.message}</td>
                  <td>{alert.acceptedBy ? "Accepted" : alert.escalation}</td>
                  <td>
                    {alert.acceptedBy ? null : (
                      <button
                        type="button"
                        className="table-button"
                        onClick={() =>
                          void fetch("/api/staff/today", {
                            method: "POST",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ id: alert.id }),
                          }).then(() => load())
                        }
                      >
                        Accept
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <h2>Size missing</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void fetch("/api/staff/missing", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ lookId }),
          })
            .then((response) => response.json())
            .then((body) => setNote(body.availability ?? body.error));
        }}
      >
        <label>
          Style
          <input value={lookId} onChange={(event) => setLookId(event.target.value)} />
        </label>
        <button type="submit" className="table-button">
          Mark missing
        </button>
      </form>
      {note ? <p className="lead">{note}</p> : null}
      <h2>Phone checklist</h2>
      {checklist.map((item) => (
        <p key={item.brand} className="lead">
          {item.brand}. {item.steps.join(". ")}.
        </p>
      ))}
    </main>
  );
}
