import type { CSSProperties, ReactNode } from "react";

const card: CSSProperties = { background: "#151A13", border: "1px solid #263023", borderRadius: 20 };
const pad = "clamp(20px,3vw,36px)";

export const Sk = ({ w = "100%", h = 16, r, style }: { w?: number | string; h?: number; r?: number; style?: CSSProperties }) => (
  <div className="sk" style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}), ...style }} />
);
const Main = ({ children, max = 1800 }: { children: ReactNode; max?: number }) => (
  <main aria-busy="true" aria-label="Loading" style={{ padding: pad, maxWidth: max, margin: "0 auto" }}>{children}</main>
);
const Stat = ({ h = 112 }: { h?: number }) => (
  <div style={{ ...card, borderRadius: 18, padding: "18px 20px", height: h }}><Sk w="45%" h={12} /><Sk w="60%" h={28} style={{ marginTop: 12 }} /><Sk w="50%" h={12} style={{ marginTop: 12 }} /></div>
);
const grid = (min: number, gap = 12): CSSProperties => ({ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`, gap });
const Rows = ({ n, cols }: { n: number; cols: string }) => (
  <div style={{ ...card, overflow: "hidden" }}>
    <div style={{ display: "grid", gridTemplateColumns: cols, gap: 16, padding: "14px 18px", borderBottom: "1px solid #2E382A" }}>{cols.split(" ").map((_, i) => <Sk key={i} w="55%" h={12} />)}</div>
    {Array.from({ length: n }, (_, r) => (
      <div key={r} style={{ display: "grid", gridTemplateColumns: cols, gap: 16, padding: "16px 18px", borderBottom: "1px solid #1F271D", alignItems: "center" }}>{cols.split(" ").map((_, i) => <Sk key={i} w={i === 0 ? "70%" : "50%"} h={14} />)}</div>
    ))}
  </div>
);

export const OfficeSkeleton = () => (
  <Main>
    <div style={grid(190)}>{[0, 1, 2, 3].map((i) => <Stat key={i} />)}</div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "36px 0 16px" }}><Sk w={90} h={22} /><Sk w={420} h={44} r={999} style={{ maxWidth: "100%" }} /></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} style={{ ...card, borderRadius: 18, padding: 18, minHeight: 212, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}><Sk w={44} h={44} r={11} /><div style={{ flex: 1 }}><Sk w="70%" h={14} /><Sk w="35%" h={11} style={{ marginTop: 8 }} /></div><Sk w={70} h={22} r={999} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 14px" }}>{[0, 1, 2, 3].map((k) => <div key={k}><Sk w="50%" h={11} /><Sk w="70%" h={16} style={{ marginTop: 6 }} /></div>)}</div>
          <Sk h={4} style={{ marginTop: "auto" }} />
        </div>
      ))}
    </div>
  </Main>
);

export const ProfileSkeleton = () => (
  <Main>
    <div style={{ ...card, borderRadius: 24, padding: 24, display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
      <Sk w={84} h={84} r={20} /><div style={{ flex: "1 1 320px" }}><Sk w="40%" h={44} /><Sk w="60%" h={14} style={{ marginTop: 14 }} /><div style={{ display: "flex", gap: 8, marginTop: 14 }}><Sk w={110} h={26} r={999} /><Sk w={110} h={26} r={999} /><Sk w={110} h={26} r={999} /></div></div>
      <div style={{ display: "flex", gap: 10 }}><Sk w={140} h={44} r={999} /><Sk w={200} h={44} r={999} /></div>
    </div>
    <div style={{ ...grid(420, 16), marginTop: 16, alignItems: "stretch" }}>
      <div style={{ ...card, borderRadius: 24, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><Sk w={140} h={16} /><Sk w={110} h={14} /></div>
        <Sk w="45%" h={96} style={{ marginTop: 18 }} /><Sk w="35%" h={12} style={{ marginTop: 10 }} /><Sk h={4} style={{ marginTop: 18 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(15, minmax(0, 1fr))", gap: 4, marginTop: 12 }}>{Array.from({ length: 15 }, (_, i) => <Sk key={i} h={28} r={5} />)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 22 }}>{[0, 1, 2].map((i) => <div key={i}><Sk w="50%" h={12} /><Sk w="70%" h={28} style={{ marginTop: 8 }} /></div>)}</div>
        <div style={{ marginTop: 26, display: "grid", gap: 16 }}>{[0, 1, 2, 3, 4].map((i) => <div key={i}><Sk w="50%" h={13} /><Sk h={8} style={{ marginTop: 8 }} /></div>)}</div>
      </div>
      <div style={{ display: "grid", gap: 16 }}>{[0, 1].map((i) => <div key={i} style={{ ...card, borderRadius: 22, padding: 20, minHeight: 230 }}><div style={{ display: "flex", justifyContent: "space-between" }}><Sk w={130} h={14} /><Sk w={70} h={22} /></div><Sk h={150} style={{ marginTop: 18 }} /></div>)}</div>
    </div>
    <div style={{ ...grid(160), marginTop: 16 }}>{[0, 1, 2, 3, 4].map((i) => <Stat key={i} h={92} />)}</div>
    <div style={{ display: "flex", gap: 8, margin: "32px 0 16px" }}>{[0, 1, 2, 3].map((i) => <Sk key={i} w={110} h={20} />)}</div>
    <Rows n={3} cols="1fr 1fr 0.8fr 1fr 1fr 1fr 0.6fr" />
  </Main>
);

export const LeaderboardSkeleton = () => (
  <Main>
    <div style={grid(300)}>{[0, 1, 2].map((i) => <div key={i} style={{ ...card, borderRadius: 22, padding: 22, display: "flex", alignItems: "center", gap: 16 }}><Sk w={40} h={52} /><Sk w={48} h={48} r={12} /><div style={{ flex: 1 }}><Sk w="70%" h={16} /><Sk w="40%" h={12} style={{ marginTop: 8 }} /></div><Sk w={60} h={28} /></div>)}</div>
    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, margin: "28px 0 14px" }}><Sk w={380} h={44} r={999} style={{ maxWidth: "100%" }} /><Sk w={560} h={36} r={999} style={{ maxWidth: "100%" }} /></div>
    <Rows n={10} cols="56px 2.2fr 1fr 0.8fr 1.1fr 1fr 1.1fr" />
  </Main>
);

export const PayrollSkeleton = () => (
  <Main>
    <div style={grid(190)}>{[0, 1, 2, 3].map((i) => <Stat key={i} />)}</div>
    <div style={{ ...grid(420, 16), marginTop: 16, alignItems: "start" }}>
      <div style={{ background: "#1A2017", border: "1px solid #263023", borderRadius: 16, padding: 32, minHeight: 500 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><Sk w={150} h={40} /><Sk w={140} h={14} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginTop: 28 }}><div><Sk w="50%" h={12} /><Sk w="70%" h={30} style={{ marginTop: 8 }} /></div><div><Sk w="50%" h={12} /><Sk w="60%" h={30} style={{ marginTop: 8 }} /></div></div>
        <Sk w="55%" h={72} style={{ marginTop: 34 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 28 }}>{[0, 1, 2, 3].map((i) => <Sk key={i} h={36} r={8} />)}</div>
        <Sk h={54} r={999} style={{ marginTop: 22 }} />
      </div>
      <div style={{ display: "grid", gap: 16 }}>{[150, 110, 80].map((h, i) => <div key={i} style={{ ...card, borderRadius: 22, padding: 22, height: h + 40 }}><Sk w="40%" h={16} /><Sk h={h - 40} style={{ marginTop: 16 }} /></div>)}</div>
    </div>
    <div style={{ margin: "36px 0 14px" }}><Sk w={180} h={22} /></div>
    <Rows n={5} cols="1fr 1fr 1.3fr 1fr 1fr 0.8fr" />
  </Main>
);

export const ProofSkeleton = () => (
  <Main>
    <Sk w="60%" h={16} style={{ marginBottom: 20 }} />
    <div style={{ ...grid(440, 16), alignItems: "start" }}>
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #2E382A", display: "flex", justifyContent: "space-between" }}><Sk w={130} h={16} /><Sk w={80} h={13} /></div>
        {Array.from({ length: 9 }, (_, i) => <div key={i} style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #222A20", minHeight: 62 }}><Sk w={18} h={18} r={9} /><div style={{ flex: 1 }}><Sk w="45%" h={14} /><Sk w="60%" h={11} style={{ marginTop: 8 }} /></div><Sk w={90} h={12} /></div>)}
      </div>
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ ...card, borderRadius: 22, padding: 24 }}><Sk w="30%" h={12} /><Sk w="55%" h={30} style={{ marginTop: 10 }} /><Sk w="40%" h={13} style={{ marginTop: 10 }} /><Sk h={64} style={{ marginTop: 20 }} /><div style={{ display: "flex", gap: 10, marginTop: 18 }}><Sk w={230} h={44} r={999} /><Sk w={140} h={44} r={999} /></div></div>
        <div style={{ ...card, borderRadius: 22, padding: 24 }}><Sk w="35%" h={16} /><Sk h={170} style={{ marginTop: 14 }} /><Sk h={52} style={{ marginTop: 12 }} /></div>
      </div>
    </div>
  </Main>
);

export const TestnetSkeleton = () => (
  <Main max={1320}>
    <div style={{ display: "grid", gap: 16 }}>
      <Sk w="55%" h={16} />
      <div style={{ ...card, padding: 22 }}><Sk w={260} h={18} /><div style={{ ...grid(230, 10), marginTop: 14 }}>{Array.from({ length: 6 }, (_, i) => <Sk key={i} h={70} r={14} />)}</div></div>
      <div style={{ ...card, padding: 22 }}><Sk w={180} h={18} /><div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>{[0, 1, 2, 3].map((i) => <Sk key={i} w={220} h={44} r={999} />)}</div></div>
      <div style={{ ...card, padding: 22 }}><Sk w={140} h={18} /><div style={{ ...grid(170, 10), marginTop: 14 }}>{Array.from({ length: 10 }, (_, i) => <Sk key={i} h={64} r={12} />)}</div></div>
    </div>
  </Main>
);

export const ClockInSkeleton = () => (
  <section aria-busy="true" aria-label="Loading" style={{ background: "#151A13", border: "1px solid #263023", borderRadius: 26, padding: "clamp(24px,4vw,48px)", maxWidth: 880, margin: "0 auto" }}>
    <Sk w="55%" h={56} /><Sk w="70%" h={16} style={{ marginTop: 18 }} />
    <div style={{ ...grid(240), marginTop: 28 }}>{[0, 1].map((i) => <Sk key={i} h={72} r={16} />)}</div>
  </section>
);
