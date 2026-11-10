import Link from "next/link";

const links = [
  { href: "/kiosk", label: "Kiosk", note: "The shop TV" },
  { href: "/kiosk/phone", label: "Phone", note: "The person holding the group" },
  { href: "/staff", label: "Staff", note: "Alerts and the day" },
  { href: "/owner", label: "Owner", note: "Tried but not bought" },
  { href: "/owner/heatmap", label: "Heatmap", note: "Anonymous zone counts" },
  { href: "/admin", label: "Admin", note: "Stores" },
  { href: "/admin/catalogue", label: "Catalogue", note: "Labels, not quantities" },
  { href: "/admin/renders", label: "Renders", note: "Core models first" },
  { href: "/whatsapp", label: "WhatsApp", note: "Local simulator" },
  { href: "/s/anna-nagar/blue-kurta", label: "A dress", note: "The hosted product page" },
];

export default function HomePage() {
  return (
    <main id="main-content" className="store-root" style={{ padding: "48px" }}>
      <p className="brand">AuraFit</p>
      <h1 style={{ fontSize: "clamp(40px, 5vw, 64px)", letterSpacing: "-0.022em", margin: "16px 0" }}>
        Kasavu & Co
      </h1>
      <p style={{ maxWidth: 520, fontSize: 21, color: "#6e6e73" }}>
        Anna Nagar. The demo store runs with no keys.
      </p>
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12, maxWidth: 480 }}>
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} style={{ color: "#0066cc", fontSize: 21 }}>
              {link.label}
            </Link>
            <span style={{ color: "#6e6e73" }}> — {link.note}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
