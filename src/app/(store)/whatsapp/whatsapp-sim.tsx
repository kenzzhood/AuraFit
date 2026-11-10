"use client";

import { useState } from "react";

type Reply = { reply: string; looks: { id: string; name: string; image?: string }[] };

export function WhatsappSim() {
  const [phone, setPhone] = useState("919840011111");
  const [text, setText] = useState("Send my AuraFit looks AF-1");
  const [reply, setReply] = useState<Reply | null>(null);

  async function send() {
    const response = await fetch("/api/whatsapp/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, text }),
    });
    setReply(await response.json());
  }

  return (
    <main className="sheet">
      <p className="brand">AuraFit · WhatsApp simulator</p>
      <h1>The shopper&apos;s phone</h1>
      <p className="lead">This stands in for Meta. No message leaves this computer.</p>
      <label>
        Number
        <input value={phone} onChange={(event) => setPhone(event.target.value)} />
      </label>
      <label>
        Message
        <input value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <button type="button" className="table-button" onClick={() => void send()}>
        Send
      </button>
      {reply ? (
        <section>
          <h2>AuraFit</h2>
          <p className="lead">{reply.reply}</p>
          <div className="tiles">
            {reply.looks.map((look) => (
              <article className="tile" key={look.id}>
                {look.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="garment" src={look.image} alt="" />
                ) : null}
                {look.name}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
