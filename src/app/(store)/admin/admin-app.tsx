"use client";

import { useEffect, useState } from "react";

type Tenant = {
  id: string;
  name: string;
  brandId: string;
  heatmap: boolean;
  legalSignOff: boolean;
};

export function AdminApp() {
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    const me = await fetch("/api/auth/session").then((response) => response.json());
    setRole(me.role ?? null);
    if (me.role !== "admin") return;
    const response = await fetch("/api/admin/stores");
    if (!response.ok) return;
    const body = await response.json();
    setTenants(body.tenants);
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
        <h1>Stores</h1>
        <p className="lead">Brand, store and device settings. Heatmaps stay off until a lawyer signs.</p>
        <button type="button" className="table-button" onClick={() => void signIn()}>
          Continue
        </button>
      </main>
    );
  }

  return (
    <main className="sheet">
      <header>
        <p className="brand">AuraFit</p>
      </header>
      <h1>Stores</h1>
      <p className="lead">Configuration only. Heatmaps stay off until legal sign-off.</p>
      {note ? <p className="lead">{note}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Store</th>
              <th>Brand</th>
              <th>Heatmap</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td>{tenant.name}</td>
                <td>{tenant.brandId}</td>
                <td>{tenant.heatmap ? "On" : "Off"}</td>
                <td>
                  <button
                    type="button"
                    className="table-button"
                    onClick={() =>
                      void fetch("/api/admin/stores", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          storeId: tenant.id,
                          enabled: true,
                          legalSignOff: false,
                        }),
                      })
                        .then((response) => response.json())
                        .then((body) => {
                          setNote(body.reason === "legal_signoff_required" ? "Legal sign-off is required." : "Updated.");
                          return load();
                        })
                    }
                  >
                    Request heatmap
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
