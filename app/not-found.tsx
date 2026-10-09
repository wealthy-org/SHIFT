import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0F130E", color: "#E4E7DA", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 48, marginBottom: 12 }}>404</h1>
      <p style={{ color: "#8E978A", marginBottom: 24 }}>Page not found</p>
      <Link href="/office" style={{ color: "#C8F135", textDecoration: "none", border: "1px solid #2A3227", padding: "8px 16px", borderRadius: 8 }}>
        Return to Office
      </Link>
    </div>
  );
}
