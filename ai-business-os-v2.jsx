import { useState, useRef, useEffect } from "react";

/* ============================================================
   AI BUSINESS OS 2.0 — evolved prototype
   Same design language as v1 · CEO AI · multi-agent system ·
   CRM · social calendar · automations · audit · marketplace
   ============================================================ */

const LANGS = { en: "English", ro: "Română", hu: "Magyar" };
const langName = { en: "English", ro: "Romanian", hu: "Hungarian" };

const T = {
  en: {
    tagline: "Your AI employee",
    groupHome: "Home", groupAgents: "AI Team", groupGrowth: "Growth", groupOps: "Operations",
    dashboard: "Dashboard", ceo: "CEO AI", assistant: "AI Agents",
    social: "Social Media Center", content: "Content Studio", ads: "Advertising Center",
    seo: "SEO Center", website: "Website Analyzer", gbp: "Google Business",
    competitors: "Competitor Intel", crm: "CRM", support: "Support Center",
    automation: "Automation", reports: "Report Center", audit: "AI Business Audit",
    marketplace: "Marketplace", pricing: "Plans & Billing",
    healthScore: "Business Health Score", scoreSub: "Composite of 7 health signals",
    revenue: "Revenue", leads: "Leads", newCustomers: "New customers", conversion: "Conversion",
    funnel: "Sales funnel", alerts: "AI alerts", recs: "Daily AI recommendations",
    tasks: "Upcoming tasks", quick: "Quick actions", activity: "Recent activity",
    dailyBriefing: "Daily briefing", weeklyReport: "Weekly report", actionPlan: "Action plan",
    priorityTasks: "Priority tasks", risks: "Risks & opportunities",
    askPlaceholder: "Ask your AI team…", send: "Send", thinking: "Thinking…",
    generate: "Generate", generating: "Generating…", schedule: "Schedule",
    platform: "Platform", topic: "Topic or product", goalLbl: "Goal",
    analyzeUrl: "Website URL", competitorName: "Competitor name",
    month: "per month", current: "Current plan", upgrade: "Upgrade",
    runAudit: "Run AI Business Audit", auditing: "Auditing all modules…",
    pipeline: "Pipeline", addLead: "Add lead", scoreLead: "AI score",
    newRule: "Rules run automatically when their trigger fires.",
    install: "Install", installed: "Installed",
    emptyChat: "Pick an agent and ask anything. Each agent has its own expertise.",
    scores: ["Marketing","Social media","SEO","Website","Google Business","Communication","Sales"],
  },
  ro: {
    tagline: "Angajatul tău AI",
    groupHome: "Acasă", groupAgents: "Echipa AI", groupGrowth: "Creștere", groupOps: "Operațiuni",
    dashboard: "Panou principal", ceo: "CEO AI", assistant: "Agenți AI",
    social: "Centru Social Media", content: "Studio de conținut", ads: "Centru de reclame",
    seo: "Centru SEO", website: "Analiză website", gbp: "Google Business",
    competitors: "Analiza concurenței", crm: "CRM", support: "Centru de suport",
    automation: "Automatizări", reports: "Centru de rapoarte", audit: "Audit AI de business",
    marketplace: "Marketplace", pricing: "Planuri și facturare",
    healthScore: "Scor de sănătate al afacerii", scoreSub: "Compus din 7 semnale",
    revenue: "Venituri", leads: "Lead-uri", newCustomers: "Clienți noi", conversion: "Conversie",
    funnel: "Funnel de vânzări", alerts: "Alerte AI", recs: "Recomandări AI zilnice",
    tasks: "Sarcini viitoare", quick: "Acțiuni rapide", activity: "Activitate recentă",
    dailyBriefing: "Briefing zilnic", weeklyReport: "Raport săptămânal", actionPlan: "Plan de acțiune",
    priorityTasks: "Sarcini prioritare", risks: "Riscuri și oportunități",
    askPlaceholder: "Întreabă echipa ta AI…", send: "Trimite", thinking: "Se gândește…",
    generate: "Generează", generating: "Se generează…", schedule: "Programează",
    platform: "Platformă", topic: "Subiect sau produs", goalLbl: "Obiectiv",
    analyzeUrl: "URL website", competitorName: "Numele concurentului",
    month: "pe lună", current: "Plan curent", upgrade: "Upgrade",
    runAudit: "Rulează auditul AI", auditing: "Se analizează toate modulele…",
    pipeline: "Pipeline", addLead: "Adaugă lead", scoreLead: "Scor AI",
    newRule: "Regulile rulează automat când se declanșează.",
    install: "Instalează", installed: "Instalat",
    emptyChat: "Alege un agent și întreabă orice. Fiecare agent are propria expertiză.",
    scores: ["Marketing","Social media","SEO","Website","Google Business","Comunicare","Vânzări"],
  },
  hu: {
    tagline: "Az AI munkatársad",
    groupHome: "Kezdőlap", groupAgents: "AI csapat", groupGrowth: "Növekedés", groupOps: "Működés",
    dashboard: "Irányítópult", ceo: "CEO AI", assistant: "AI ügynökök",
    social: "Közösségi média központ", content: "Tartalom stúdió", ads: "Hirdetési központ",
    seo: "SEO központ", website: "Weboldal elemző", gbp: "Google Business",
    competitors: "Versenytárs figyelés", crm: "CRM", support: "Ügyfélszolgálat",
    automation: "Automatizálás", reports: "Riport központ", audit: "AI üzleti audit",
    marketplace: "Piactér", pricing: "Csomagok és számlázás",
    healthScore: "Üzleti egészség pontszám", scoreSub: "7 jelzőből számítva",
    revenue: "Bevétel", leads: "Érdeklődők", newCustomers: "Új ügyfelek", conversion: "Konverzió",
    funnel: "Értékesítési tölcsér", alerts: "AI riasztások", recs: "Napi AI javaslatok",
    tasks: "Közelgő feladatok", quick: "Gyors műveletek", activity: "Legutóbbi aktivitás",
    dailyBriefing: "Napi összefoglaló", weeklyReport: "Heti riport", actionPlan: "Cselekvési terv",
    priorityTasks: "Kiemelt feladatok", risks: "Kockázatok és lehetőségek",
    askPlaceholder: "Kérdezd az AI csapatod…", send: "Küldés", thinking: "Gondolkodik…",
    generate: "Generálás", generating: "Generálás…", schedule: "Ütemezés",
    platform: "Platform", topic: "Téma vagy termék", goalLbl: "Cél",
    analyzeUrl: "Weboldal URL", competitorName: "Versenytárs neve",
    month: "havonta", current: "Jelenlegi csomag", upgrade: "Váltás",
    runAudit: "AI üzleti audit indítása", auditing: "Minden modul elemzése…",
    pipeline: "Folyamat", addLead: "Új érdeklődő", scoreLead: "AI pontszám",
    newRule: "A szabályok automatikusan futnak, amikor a feltétel teljesül.",
    install: "Telepítés", installed: "Telepítve",
    emptyChat: "Válassz ügynököt és kérdezz bármit. Mindegyiknek saját szakterülete van.",
    scores: ["Marketing","Közösségi média","SEO","Weboldal","Google Business","Kommunikáció","Értékesítés"],
  },
};

const BIZ_CONTEXT = {
  name: "Café Aurora",
  type: "specialty coffee shop & bakery",
  city: "Miercurea-Ciuc, Romania",
  monthlyRevenue: "€11,400 (down 8% vs last month)",
  channels: "Facebook 2.3k, Instagram 1.1k, Google Business 4.6★ / 128 reviews",
  goals: "grow weekday morning traffic, launch catering line, reach 3k FB followers",
  crm: "14 open deals worth €6,850; 7 leads without follow-up",
  signals: "FB engagement -18% this week; 5 new negative reviews; competitor Café Central published 12 videos; website conversion 1.9% (was 2.4%)",
};

const SCORE_VALUES = [72, 64, 58, 81, 88, 76, 61];
const SCORE_COLORS = ["#4C7DF0","#8B5CF6","#E0AA3E","#2FA98C","#2FA98C","#4C7DF0","#E0703A"];

const AGENTS = [
  ["ceo","◆","CEO"],["marketing","◈","Marketing"],["social","▣","Social Media"],
  ["seo","◎","SEO"],["sales","↗","Sales"],["support","☎","Support"],
  ["crm","▥","CRM"],["ads","▲","Advertising"],["analytics","▤","Analytics"],
  ["finance","€","Finance"],["website","⌘","Website"],["content","✎","Content"],
  ["branding","❖","Branding"],["automation","⟳","Automation"],
];

async function askClaude(system, messages, maxTokens = 1000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages }),
  });
  const data = await res.json();
  return (data.content || []).map((b) => b.text || "").join("\n");
}

function sysPrompt(lang, role) {
  return `You are the ${role} agent inside "AI Business OS", an AI employee platform for small businesses.
Business context: ${JSON.stringify(BIZ_CONTEXT)}.
Respond in ${langName[lang]}. Be concrete, practical and concise. Short paragraphs or tight lists. No preamble.`;
}

/* ---------- atoms ---------- */

const Card = ({ children, className = "", style, onClick }) => (
  <div className={`card ${className}`} style={style} onClick={onClick}>{children}</div>
);
const Spinner = () => <span className="spinner" aria-hidden="true" />;
const Output = ({ text }) => (text ? <div className="output">{text}</div> : null);

function Sparkline({ data, color = "var(--accent)", up = true }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" width="100%" height="30" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ScoreRing({ values, colors, labels, size = 200 }) {
  const total = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const R = 84, C = 2 * Math.PI * R, gap = 6, segLen = C / values.length - gap;
  return (
    <div className="ringWrap">
      <svg viewBox="0 0 220 220" width={size} height={size} role="img" aria-label={`Score ${total}`}>
        {values.map((v, i) => {
          const offset = (C / values.length) * i;
          return (
            <g key={i}>
              <circle cx="110" cy="110" r={R} fill="none" stroke="var(--ring-track)" strokeWidth="12"
                strokeDasharray={`${segLen} ${C - segLen}`} strokeDashoffset={-offset} strokeLinecap="round" />
              <circle cx="110" cy="110" r={R} fill="none" stroke={colors[i]} strokeWidth="12"
                strokeDasharray={`${(segLen * v) / 100} ${C}`} strokeDashoffset={-offset}
                strokeLinecap="round" style={{ transition: "stroke-dasharray .8s ease" }} />
            </g>
          );
        })}
        <text x="110" y="104" textAnchor="middle" className="ringNum">{total}</text>
        <text x="110" y="130" textAnchor="middle" className="ringSub">/ 100</text>
      </svg>
      <div className="ringLegend">
        {labels.map((l, i) => (
          <div key={l} className="legendRow">
            <span className="dot" style={{ background: colors[i] }} />
            <span className="legendLabel">{l}</span><span className="legendVal">{values[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Dashboard 2.0 ---------- */

function Dashboard({ t, lang, go }) {
  const kpis = [
    { label: t.revenue, val: "€11,400", delta: "-8%", bad: true, data: [14,13.6,12.9,13.2,12.4,11.9,11.4] },
    { label: t.leads, val: "38", delta: "+12%", data: [22,25,24,29,31,34,38] },
    { label: t.newCustomers, val: "17", delta: "+5%", data: [11,12,14,13,15,16,17] },
    { label: t.conversion, val: "1.9%", delta: "-0.5pt", bad: true, data: [2.6,2.5,2.4,2.3,2.2,2.0,1.9] },
  ];
  const funnel = [["Visitors", 4210],["Leads", 38],["Qualified", 21],["Deals", 14],["Won", 6]];
  const alerts = {
    en: [["⚠","Facebook engagement dropped 18% this week."],["⚠","5 negative reviews received — 3 unanswered."],["◉","Competitor Café Central published 12 videos."],["⚠","7 leads have no follow-up."],["◉","Website conversion fell from 2.4% to 1.9%."]],
    ro: [["⚠","Engagementul pe Facebook a scăzut cu 18%."],["⚠","5 recenzii negative — 3 fără răspuns."],["◉","Concurentul Café Central a publicat 12 videoclipuri."],["⚠","7 lead-uri fără follow-up."],["◉","Conversia site-ului a scăzut de la 2,4% la 1,9%."]],
    hu: [["⚠","A Facebook elköteleződés 18%-kal esett a héten."],["⚠","5 negatív értékelés — 3 megválaszolatlan."],["◉","A Café Central versenytárs 12 videót tett közzé."],["⚠","7 érdeklődőnél nincs utánkövetés."],["◉","A weboldal konverzió 2,4%-ról 1,9%-ra esett."]],
  };
  const recs = {
    en: ["Launch a Google Ads campaign for “catering Miercurea-Ciuc” — search volume is up.","Reply to the 3 unanswered negative reviews today (drafts ready in Google Business).","Post 2 Reels this week — short video is your top-reach format."],
    ro: ["Lansează o campanie Google Ads pentru „catering Miercurea-Ciuc” — volumul de căutare crește.","Răspunde azi la cele 3 recenzii negative (ciorne pregătite în Google Business).","Publică 2 Reels săptămâna asta — video scurt e formatul cu cel mai mare reach."],
    hu: ["Indíts Google Ads kampányt a „catering Csíkszereda” kifejezésre — nő a keresési volumen.","Válaszolj ma a 3 megválaszolatlan negatív értékelésre (a piszkozatok készen állnak).","Tegyél ki 2 Reels-t a héten — a rövid videó hozza a legnagyobb elérést."],
  };
  const quick = [
    [t.dailyBriefing, () => go("ceo")], [t.runAudit, () => go("audit")],
    [t.schedule + " →", () => go("social")], [t.addLead, () => go("crm")],
  ];
  const maxF = funnel[0][1];
  return (
    <div className="grid">
      {kpis.map((k) => (
        <Card key={k.label} className="kpi">
          <div className="kpiTop"><span className="muted small">{k.label}</span>
            <span className={k.bad ? "delta bad" : "delta good"}>{k.delta}</span></div>
          <div className="kpiVal">{k.val}</div>
          <Sparkline data={k.data} color={k.bad ? "#E0703A" : "#2FA98C"} />
        </Card>
      ))}
      <Card className="span2">
        <div className="cardTitle">{t.healthScore}</div>
        <div className="cardSub">{t.scoreSub} · Café Aurora</div>
        <ScoreRing values={SCORE_VALUES} colors={SCORE_COLORS} labels={t.scores} />
      </Card>
      <Card>
        <div className="cardTitle">{t.funnel}</div>
        {funnel.map(([s, v]) => (
          <div key={s} className="funnelRow">
            <span className="funnelLabel">{s}</span>
            <div className="bar"><div className="barFill" style={{ width: Math.max(4,(v/maxF)*100) + "%" }} /></div>
            <span className="funnelVal">{v}</span>
          </div>
        ))}
      </Card>
      <Card>
        <div className="cardTitle">{t.alerts}</div>
        {alerts[lang].map(([ic, a]) => <div key={a} className="rec"><span className="alertIc">{ic}</span> {a}</div>)}
      </Card>
      <Card>
        <div className="cardTitle">{t.recs}</div>
        {recs[lang].map((r) => <div key={r} className="rec">✦ {r}</div>)}
      </Card>
      <Card>
        <div className="cardTitle">{t.quick}</div>
        <div className="quickGrid">
          {quick.map(([label, fn]) => <button key={label} className="ghost" onClick={fn}>{label}</button>)}
        </div>
        <div className="cardTitle" style={{ marginTop: 18 }}>{t.tasks}</div>
        {[["Mon","Approve content calendar"],["Tue","Review catering page copy"],["Fri","Monthly report"]].map(([d, x]) => (
          <div key={x} className="row"><span className="pill">{d}</span>{x}</div>
        ))}
      </Card>
    </div>
  );
}

/* ---------- CEO AI ---------- */

function CeoAI({ t, lang }) {
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState("");
  async function run(kind, prompt) {
    if (busy) return;
    setBusy(kind); setOut("");
    try {
      setOut(await askClaude(sysPrompt(lang, "CEO — you oversee every module and coordinate all agents"),
        [{ role: "user", content: prompt }], 1400));
    } catch { setOut("⚠ Connection error — try again."); }
    setBusy("");
  }
  const actions = [
    [t.dailyBriefing, "Give today's daily briefing: 1) top 3 things that need attention (use the live signals), 2) one growth opportunity, 3) one risk, 4) 3 priority tasks for today with owners (which agent handles it)."],
    [t.weeklyReport, "Write this week's business report: performance summary per area (marketing, social, sales, website, reviews), what improved, what declined, and next week's focus. Compact."],
    [t.actionPlan, "Create an automatic action plan for the next 7 days that fixes the negative signals: assign each action to the right AI agent, give it a priority and expected impact."],
    [t.risks, "List the top 3 risks and top 3 growth opportunities right now, each with one concrete next step."],
  ];
  return (
    <div className="ceoShell">
      <Card className="ceoHead">
        <div className="ceoAvatar">◆</div>
        <div>
          <div className="cardTitle">CEO AI</div>
          <div className="cardSub">{t.scoreSub.split("·")[0]} — Marketing · Sales · SEO · Social · CRM · Reviews · Website</div>
        </div>
      </Card>
      <div className="chips" style={{ justifyContent: "flex-start" }}>
        {actions.map(([label, p]) => (
          <button key={label} className="chip big" onClick={() => run(label, p)} disabled={!!busy}>
            {busy === label ? <><Spinner /> {t.generating}</> : label}
          </button>
        ))}
      </div>
      <Card style={{ minHeight: 220 }}>
        {busy && <div className="muted"><Spinner /> {t.thinking}</div>}
        <Output text={out} />
        {!out && !busy && <div className="muted small">✦ {t.recs}: {t.dailyBriefing} →</div>}
      </Card>
    </div>
  );
}

/* ---------- Multi-agent chat ---------- */

function Agents({ t, lang }) {
  const [agent, setAgent] = useState("marketing");
  const [threads, setThreads] = useState({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const msgs = threads[agent] || [];
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [threads, busy]);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    const next = [...msgs, { role: "user", content: q }];
    setThreads({ ...threads, [agent]: next }); setInput(""); setBusy(true);
    const name = AGENTS.find(([k]) => k === agent)?.[2];
    try {
      const reply = await askClaude(sysPrompt(lang, name), next);
      setThreads((th) => ({ ...th, [agent]: [...next, { role: "assistant", content: reply }] }));
    } catch {
      setThreads((th) => ({ ...th, [agent]: [...next, { role: "assistant", content: "⚠ Connection error." }] }));
    }
    setBusy(false);
  }

  return (
    <div className="agentShell">
      <div className="agentRail">
        {AGENTS.map(([k, ic, name]) => (
          <button key={k} className={agent === k ? "agentBtn active" : "agentBtn"} onClick={() => setAgent(k)}>
            <span className="agentIc">{ic}</span><span>{name}</span>
            {(threads[k] || []).length > 0 && <span className="agentCount">{Math.ceil((threads[k].length)/2)}</span>}
          </button>
        ))}
      </div>
      <div className="chatShell" style={{ height: "calc(100vh - 140px)" }}>
        <div className="chatScroll">
          {msgs.length === 0 && <div className="chatEmpty"><p>{t.emptyChat}</p></div>}
          {msgs.map((m, i) => <div key={i} className={`bubble ${m.role}`}>{m.content}</div>)}
          {busy && <div className="bubble assistant muted"><Spinner /> {t.thinking}</div>}
          <div ref={endRef} />
        </div>
        <div className="chatInput">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()} placeholder={t.askPlaceholder} />
          <button className="primary" onClick={send} disabled={busy}>{t.send}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- CRM ---------- */

const STAGES = ["New", "Contacted", "Proposal", "Won"];
const INITIAL_DEALS = [
  { id: 1, name: "TechPark office — weekly pastries", value: 1800, stage: 0, contact: "A. Balázs" },
  { id: 2, name: "Wedding catering (June)", value: 2400, stage: 1, contact: "M. Popescu" },
  { id: 3, name: "School event — 120 boxes", value: 950, stage: 1, contact: "K. Szabó" },
  { id: 4, name: "Coworking coffee contract", value: 1200, stage: 2, contact: "R. Ionescu" },
  { id: 5, name: "Birthday order — custom cake", value: 180, stage: 3, contact: "E. Kovács" },
];

function CRM({ t, lang }) {
  const [deals, setDeals] = useState(INITIAL_DEALS);
  const [name, setName] = useState("");
  const [aiOut, setAiOut] = useState("");
  const [busyId, setBusyId] = useState(null);

  function move(id, dir) {
    setDeals(deals.map((d) => d.id === id
      ? { ...d, stage: Math.min(STAGES.length - 1, Math.max(0, d.stage + dir)) } : d));
  }
  function add() {
    if (!name.trim()) return;
    setDeals([...deals, { id: Date.now(), name: name.trim(), value: 0, stage: 0, contact: "—" }]);
    setName("");
  }
  async function score(d) {
    if (busyId) return;
    setBusyId(d.id); setAiOut("");
    try {
      setAiOut(await askClaude(sysPrompt(lang, "CRM"),
        [{ role: "user", content: `Lead/deal: "${d.name}" (€${d.value}, stage: ${STAGES[d.stage]}, contact: ${d.contact}). Give: lead score 1–10 with one-line reasoning, a ready-to-send follow-up message, and the recommended next step.` }]));
    } catch { setAiOut("⚠ Connection error."); }
    setBusyId(null);
  }
  const total = deals.filter((d) => d.stage < 3).reduce((a, d) => a + d.value, 0);

  return (
    <div>
      <div className="crmTop">
        <div className="muted small">{t.pipeline}: <b style={{ color: "var(--text)" }}>€{total.toLocaleString()}</b> open</div>
        <div className="crmAdd">
          <input placeholder={t.addLead + "…"} value={name}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button className="primary" onClick={add}>+</button>
        </div>
      </div>
      <div className="kanban">
        {STAGES.map((s, si) => (
          <div key={s} className="kanbanCol">
            <div className="kanbanHead">{s} <span className="muted">{deals.filter((d) => d.stage === si).length}</span></div>
            {deals.filter((d) => d.stage === si).map((d) => (
              <Card key={d.id} className="dealCard">
                <div className="dealName">{d.name}</div>
                <div className="muted small">{d.contact} · {d.value ? "€" + d.value : "—"}</div>
                <div className="dealBtns">
                  <button className="mini" onClick={() => move(d.id, -1)} disabled={si === 0}>‹</button>
                  <button className="mini" onClick={() => score(d)}>
                    {busyId === d.id ? <Spinner /> : "✦ " + t.scoreLead}
                  </button>
                  <button className="mini" onClick={() => move(d.id, 1)} disabled={si === STAGES.length - 1}>›</button>
                </div>
              </Card>
            ))}
          </div>
        ))}
      </div>
      {(aiOut || busyId) && <Card style={{ marginTop: 16 }}>{busyId && <div className="muted"><Spinner /> {t.thinking}</div>}<Output text={aiOut} /></Card>}
    </div>
  );
}

/* ---------- Social Media Center ---------- */

function SocialCenter({ t, lang }) {
  const [posts, setPosts] = useState({ 3: ["FB · Spring latte"], 8: ["IG · Reel: latte art"], 14: ["GB · Weekly post"], 21: ["TikTok · Behind the scenes"] });
  const [platform, setPlatform] = useState("Facebook");
  const [topic, setTopic] = useState("");
  const [day, setDay] = useState(10);
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  async function gen() {
    if (busy) return;
    setBusy(true); setOut("");
    try {
      setOut(await askClaude(sysPrompt(lang, "Social Media"),
        [{ role: "user", content: `Create a ${platform} post about "${topic || "our specialty coffee"}". Include: post copy, 5 hashtags, CTA, image idea, best posting time suggestion.` }]));
    } catch { setOut("⚠ Connection error."); }
    setBusy(false);
  }
  function schedule() {
    if (!out) return;
    setPosts({ ...posts, [day]: [...(posts[day] || []), `${platform.slice(0, 2).toUpperCase()} · ${topic || "AI post"}`] });
  }

  return (
    <div className="genShell">
      <div>
        <Card>
          <label className="field"><span>{t.platform}</span>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {["Facebook","Instagram","TikTok","LinkedIn","Pinterest","Threads","Google Business","YouTube Shorts","X"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className="field"><span>{t.topic}</span>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. new spring latte" />
          </label>
          <button className="primary wide" onClick={gen} disabled={busy}>
            {busy ? <><Spinner /> {t.generating}</> : t.generate}
          </button>
          {out && (
            <div className="schedRow">
              <select value={day} onChange={(e) => setDay(+e.target.value)}>
                {Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>Day {i + 1}</option>)}
              </select>
              <button className="ghost" onClick={schedule}>{t.schedule}</button>
            </div>
          )}
        </Card>
        {out && <Card style={{ marginTop: 14 }}><Output text={out} /></Card>}
      </div>
      <Card>
        <div className="cardTitle">Content calendar · June</div>
        <div className="calGrid">
          {Array.from({ length: 28 }, (_, i) => {
            const d = i + 1;
            return (
              <div key={d} className={posts[d] ? "calCell has" : "calCell"} onClick={() => setDay(d)}>
                <span className="calDay">{d}</span>
                {(posts[d] || []).map((p) => <div key={p} className="calPost">{p}</div>)}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ---------- generic generator ---------- */

function Generator({ t, lang, role, fields, buildPrompt, maxTokens }) {
  const [vals, setVals] = useState({});
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    if (busy) return;
    setBusy(true); setOut("");
    try {
      setOut(await askClaude(sysPrompt(lang, role), [{ role: "user", content: buildPrompt(vals) }], maxTokens || 1000));
    } catch { setOut("⚠ Connection error."); }
    setBusy(false);
  }
  return (
    <div className="genShell">
      <Card>
        {fields.map((f) => (
          <label key={f.key} className="field"><span>{f.label}</span>
            {f.options ? (
              <select value={vals[f.key] || f.options[0]} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}>
                {f.options.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : (
              <input placeholder={f.placeholder || ""} value={vals[f.key] || ""}
                onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />
            )}
          </label>
        ))}
        <button className="primary wide" onClick={go} disabled={busy}>
          {busy ? <><Spinner /> {t.generating}</> : t.generate}
        </button>
      </Card>
      <Card style={{ minHeight: 160 }}>
        {busy && <div className="muted"><Spinner /> {t.thinking}</div>}
        <Output text={out} />
      </Card>
    </div>
  );
}

/* ---------- Automation ---------- */

const RULES_INIT = [
  { id: 1, ifTxt: "New Google review appears", thenTxt: "Draft AI reply + notify owner", on: true },
  { id: 2, ifTxt: "New lead is created", thenTxt: "Send welcome email + create follow-up task", on: true },
  { id: 3, ifTxt: "Engagement drops >15%", thenTxt: "Recommend campaign to CEO AI", on: true },
  { id: 4, ifTxt: "Every Monday 08:00", thenTxt: "Generate weekly report", on: false },
];
const IF_OPTS = ["New Google review appears","New lead is created","Engagement drops >15%","Every Monday 08:00","Deal stuck >7 days","New negative review"];
const THEN_OPTS = ["Draft AI reply + notify owner","Send welcome email + create follow-up task","Recommend campaign to CEO AI","Generate weekly report","Alert owner","Create priority task"];

function Automation({ t }) {
  const [rules, setRules] = useState(RULES_INIT);
  const [ifV, setIfV] = useState(IF_OPTS[0]);
  const [thenV, setThenV] = useState(THEN_OPTS[0]);
  return (
    <div style={{ maxWidth: 720 }}>
      <Card>
        <div className="cardTitle">{t.automation}</div>
        <div className="cardSub">{t.newRule}</div>
        {rules.map((r) => (
          <div key={r.id} className="ruleRow">
            <button className={r.on ? "toggle on" : "toggle"} aria-label="toggle"
              onClick={() => setRules(rules.map((x) => x.id === r.id ? { ...x, on: !x.on } : x))}>
              <span className="knob" /></button>
            <div className="ruleTxt">
              <span className="pill">IF</span> {r.ifTxt}
              <span className="pill" style={{ marginLeft: 8 }}>THEN</span> {r.thenTxt}
            </div>
          </div>
        ))}
        <div className="ruleBuilder">
          <span className="pill">IF</span>
          <select value={ifV} onChange={(e) => setIfV(e.target.value)}>{IF_OPTS.map((o) => <option key={o}>{o}</option>)}</select>
          <span className="pill">THEN</span>
          <select value={thenV} onChange={(e) => setThenV(e.target.value)}>{THEN_OPTS.map((o) => <option key={o}>{o}</option>)}</select>
          <button className="primary" onClick={() => setRules([...rules, { id: Date.now(), ifTxt: ifV, thenTxt: thenV, on: true }])}>+</button>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Audit ---------- */

function Audit({ t, lang }) {
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const scores = [["Business", 71],["Growth", 66],["Marketing", 72],["SEO", 58],["Sales", 61],["Website", 81],["Brand", 74],["Customers", 79],["Competitors", 63],["Automation", 55]];
  async function run() {
    if (busy) return;
    setBusy(true); setOut("");
    try {
      setOut(await askClaude(sysPrompt(lang, "Business Auditor — you analyze every module"),
        [{ role: "user", content: `Run a full business audit using the context and these module scores: ${JSON.stringify(scores)}. Produce: strengths (3), weaknesses (3), quick wins (5, each doable this week), long-term strategy (3 points), and a 90-day roadmap by month. Compact but complete.` }], 1600));
    } catch { setOut("⚠ Connection error."); }
    setBusy(false);
  }
  return (
    <div>
      <div className="auditScores">
        {scores.map(([n, v]) => (
          <Card key={n} className="auditCell">
            <div className="kpiVal" style={{ fontSize: 22, color: v >= 70 ? "#2FA98C" : v >= 60 ? "#E0AA3E" : "#E0703A" }}>{v}</div>
            <div className="muted small">{n}</div>
          </Card>
        ))}
      </div>
      <button className="primary wide" style={{ maxWidth: 360, margin: "18px auto", display: "flex" }} onClick={run} disabled={busy}>
        {busy ? <><Spinner /> {t.auditing}</> : "✦ " + t.runAudit}
      </button>
      {(out || busy) && <Card>{busy && <div className="muted"><Spinner /> {t.auditing}</div>}<Output text={out} /></Card>}
    </div>
  );
}

/* ---------- Reports ---------- */

function Reports({ t, lang }) {
  const types = ["Marketing Report","SEO Report","Website Audit","Sales Report","Competitor Report","Business Report"];
  const [sel, setSel] = useState(types[0]);
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  async function run() {
    if (busy) return;
    setBusy(true); setOut("");
    try {
      setOut(await askClaude(sysPrompt(lang, "Analytics"),
        [{ role: "user", content: `Generate a professional "${sel}" for this month with realistic sample numbers consistent with the business context: executive summary, key metrics table (as plain text), what changed, and 3 recommendations. Note it is a sample report.` }], 1400));
    } catch { setOut("⚠ Connection error."); }
    setBusy(false);
  }
  return (
    <div className="genShell">
      <Card>
        {types.map((x) => (
          <button key={x} className={sel === x ? "navBtn active" : "navBtn"} style={{ width: "100%" }} onClick={() => setSel(x)}>
            <span className="navIc">▤</span>{x}
          </button>
        ))}
        <button className="primary wide" onClick={run} disabled={busy}>
          {busy ? <><Spinner /> {t.generating}</> : t.generate}
        </button>
      </Card>
      <Card style={{ minHeight: 200 }}>
        {busy && <div className="muted"><Spinner /> {t.thinking}</div>}
        <Output text={out} />
      </Card>
    </div>
  );
}

/* ---------- Marketplace ---------- */

function Marketplace({ t }) {
  const apps = [["Restaurant AI","🍽"],["Hotel AI","🏨"],["Dentist AI","🦷"],["Law Firm AI","⚖️"],["Real Estate AI","🏠"],["Gym AI","💪"],["Beauty Salon AI","💇"],["Car Dealer AI","🚗"],["Construction AI","🏗"],["Medical AI","🩺"]];
  const [inst, setInst] = useState({ "Restaurant AI": true });
  return (
    <div className="plans">
      {apps.map(([name, ic]) => (
        <Card key={name} style={{ textAlign: "center" }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>{ic}</div>
          <div className="planName">{name}</div>
          <p className="muted small" style={{ minHeight: 34 }}>Industry playbooks, prompts & KPIs tuned for this vertical.</p>
          <button className={inst[name] ? "ghost wide" : "primary wide"}
            onClick={() => setInst({ ...inst, [name]: !inst[name] })}>
            {inst[name] ? "✓ " + t.installed : t.install}
          </button>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Pricing ---------- */

function Pricing({ t }) {
  const plans = [
    { name: "Free", price: "€0", feats: ["1 user","CEO AI briefing (1/day)","Dashboard","1 social channel"] },
    { name: "Starter", price: "€19", feats: ["1 user","All agents","3 social channels","CRM (50 deals)"] },
    { name: "Pro", price: "€49", hot: true, feats: ["3 users","All modules","Scheduler + calendar","Automations","Audit + reports"] },
    { name: "Business", price: "€99", feats: ["10 users","Unified inbox","Marketplace apps","Priority support"] },
    { name: "Enterprise", price: "Custom", feats: ["Unlimited users","SSO & API","Custom AI training","Dedicated manager"] },
  ];
  return (
    <div className="plans">
      {plans.map((p, i) => (
        <Card key={p.name} className={p.hot ? "hotPlan" : ""}>
          <div className="planName">{p.name}</div>
          <div className="planPrice">{p.price}<span className="muted small"> {p.price !== "Custom" ? "/" + t.month : ""}</span></div>
          <ul className="planFeats">{p.feats.map((f) => <li key={f}>{f}</li>)}</ul>
          <button className={p.hot ? "primary wide" : "ghost wide"}>{i === 0 ? t.current : t.upgrade}</button>
        </Card>
      ))}
    </div>
  );
}

/* ---------- app ---------- */

export default function App() {
  const [lang, setLang] = useState("hu");
  const [dark, setDark] = useState(true);
  const [page, setPage] = useState("dashboard");
  const t = T[lang];

  const groups = [
    [t.groupHome, [["dashboard","◧",t.dashboard],["ceo","◆",t.ceo]]],
    [t.groupAgents, [["agents","✦",t.assistant]]],
    [t.groupGrowth, [
      ["social","▣",t.social],["content","✎",t.content],["ads","▲",t.ads],
      ["seo","◎",t.seo],["website","⌘",t.website],["gbp","★",t.gbp],["competitors","⚔",t.competitors],
    ]],
    [t.groupOps, [
      ["crm","▥",t.crm],["support","☎",t.support],["automation","⟳",t.automation],
      ["reports","▤",t.reports],["audit","✓",t.audit],
    ]],
    ["", [["marketplace","▦",t.marketplace],["pricing","◇",t.pricing]]],
  ];
  const flat = groups.flatMap(([, items]) => items);

  const pageEl = (() => {
    switch (page) {
      case "dashboard": return <Dashboard t={t} lang={lang} go={setPage} />;
      case "ceo": return <CeoAI t={t} lang={lang} />;
      case "agents": return <Agents t={t} lang={lang} />;
      case "social": return <SocialCenter t={t} lang={lang} key={lang} />;
      case "crm": return <CRM t={t} lang={lang} />;
      case "automation": return <Automation t={t} />;
      case "audit": return <Audit t={t} lang={lang} />;
      case "reports": return <Reports t={t} lang={lang} key={lang} />;
      case "marketplace": return <Marketplace t={t} />;
      case "pricing": return <Pricing t={t} />;
      case "content": return <Generator t={t} lang={lang} role="Content" key={"c"+lang}
        fields={[
          { key: "type", label: t.platform, options: ["Blog post","Landing page","Email","Newsletter","SMS","Push notification","TikTok script","LinkedIn article","Sales page","Product description","Video script","Podcast script"] },
          { key: "topic", label: t.topic, placeholder: "e.g. catering launch" },
        ]}
        buildPrompt={(v) => `Write a ${v.type || "blog post"} about "${v.topic || "our catering launch"}". Conversion-focused, structured, ready to use.`} />;
      case "ads": return <Generator t={t} lang={lang} role="Advertising" key={"a"+lang}
        fields={[
          { key: "platform", label: t.platform, options: ["Meta Ads","Google Ads","TikTok Ads","LinkedIn Ads"] },
          { key: "goal", label: t.goalLbl, placeholder: "e.g. catering leads" },
        ]}
        buildPrompt={(v) => `Create a ${v.platform || "Meta Ads"} campaign for goal "${v.goal || "catering leads"}": campaign structure, 2 ad copies (headline + primary text), audience suggestions, budget split for €300/month, and one A/B test idea.`} />;
      case "seo": return <Generator t={t} lang={lang} role="SEO" key={"s"+lang} maxTokens={1400}
        fields={[{ key: "kw", label: t.topic, placeholder: "e.g. catering Miercurea-Ciuc" }]}
        buildPrompt={(v) => `SEO workspace for "${v.kw || "specialty coffee Miercurea-Ciuc"}": sample keyword list with estimated difficulty labels (low/med/high), competitor keyword angles, one content-gap idea, meta title + description, internal link suggestions, one schema recommendation, and a blog outline. Label estimates as samples.`} />;
      case "website": return <Generator t={t} lang={lang} role="Website" key={"w"+lang} maxTokens={1400}
        fields={[{ key: "url", label: t.analyzeUrl, placeholder: "https://cafeaurora.ro" }]}
        buildPrompt={(v) => `Produce a sample professional audit framework for ${v.url || "the site"}: scores to measure (SEO, accessibility, performance, Core Web Vitals, conversion, mobile, trust, security), a prioritized issue list typical for a café site, improvement suggestions, and an AI action plan. Label as sample.`} />;
      case "gbp": return <Generator t={t} lang={lang} role="Google Business" key={"g"+lang}
        fields={[{ key: "review", label: t.topic, placeholder: "Paste a review… (or leave empty)" }]}
        buildPrompt={(v) => v.review
          ? `Owner reply to this review: "${v.review}". Then one Google Post idea and one photo suggestion.`
          : `Weekly Google Business plan: replies for the 3 negative reviews (generic but warm templates), 1 Google Post (full text), 3 Q&A entries, 2 photo suggestions, and one local-ranking action.`} />;
      case "competitors": return <Generator t={t} lang={lang} role="Competitor Intelligence" key={"k"+lang} maxTokens={1400}
        fields={[{ key: "name", label: t.competitorName, placeholder: "e.g. Café Central" }]}
        buildPrompt={(v) => `Competitor brief on "${v.name || "Café Central"}" (they published 12 videos this week): monitoring checklist (website, SEO, social, ads, reviews, pricing, blog), sample SWOT, market position, 3 opportunities, 2 threats, AI recommendations. Label as sample analysis.`} />;
      case "support": return <Generator t={t} lang={lang} role="Customer Support" key={"u"+lang}
        fields={[{ key: "msg", label: t.topic, placeholder: "Paste a customer message…" }]}
        buildPrompt={(v) => v.msg
          ? `Customer message: "${v.msg}". Draft: reply, short Messenger/WhatsApp version, sentiment (positive/neutral/negative), ticket category, and whether it's a lead.`
          : `Create: 6-entry smart FAQ, 3 auto-reply templates (greeting, out-of-hours, complaint), and a simple ticket triage guide (categories + priorities).`} />;
      default: return null;
    }
  })();

  return (
    <div className={dark ? "app dark" : "app"}>
      <style>{CSS}</style>
      <aside className="side">
        <div className="logo"><span className="logoMark">◆</span><span className="logoTxt"> AI Business OS</span></div>
        <div className="taglineTxt">{t.tagline} · 2.0</div>
        <nav>
          {groups.map(([g, items]) => (
            <div key={g || "misc"}>
              {g && <div className="navGroup">{g}</div>}
              {items.map(([k, ic, label]) => (
                <button key={k} className={page === k ? "navBtn active" : "navBtn"} onClick={() => setPage(k)}>
                  <span className="navIc">{ic}</span><span className="navLabel">{label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sideFoot">
          <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">
            {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="ghost" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? "☀" : "☾"}</button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <h1>{flat.find(([k]) => k === page)?.[2]}</h1>
          <div className="userChip"><span className="notifDot">3</span><span className="avatar">CA</span><span className="chipTxt"> Café Aurora · Pro</span></div>
        </header>
        <div className="content">{pageEl}</div>
      </main>
    </div>
  );
}

/* ---------- styles ---------- */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

.app{
  --bg:#F6F6F3; --surface:#FFFFFF; --line:#E6E5E0; --text:#1B1C1E; --muted:#75767B;
  --accent:#2D5BFF; --accent-soft:#EBF0FF; --ring-track:#ECEBE6;
  display:flex; min-height:100vh; background:var(--bg); color:var(--text);
  font-family:'Inter',system-ui,sans-serif; font-size:14px;
}
.app.dark{
  --bg:#101114; --surface:#17181D; --line:#26272E; --text:#EDEDEF; --muted:#8B8C94;
  --accent:#5B7CFF; --accent-soft:#1C2440; --ring-track:#23242B;
}
*{box-sizing:border-box} button{font:inherit;cursor:pointer} input,select{font:inherit}

.side{width:248px;flex-shrink:0;border-right:1px solid var(--line);background:var(--surface);
  display:flex;flex-direction:column;padding:18px 12px;position:sticky;top:0;height:100vh;overflow-y:auto}
.logo{font-family:'Sora';font-weight:700;font-size:16px;display:flex;align-items:center;gap:8px;padding:0 8px}
.logoMark{color:var(--accent)}
.taglineTxt{color:var(--muted);font-size:12px;padding:2px 8px 10px}
nav{display:flex;flex-direction:column;gap:2px;flex:1}
.navGroup{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);
  padding:12px 10px 4px;font-weight:600}
.navBtn{display:flex;align-items:center;gap:10px;padding:6px 10px;border:none;background:none;
  color:var(--muted);border-radius:8px;text-align:left;font-weight:500;width:100%}
.navBtn:hover{background:var(--bg);color:var(--text)}
.navBtn.active{background:var(--accent-soft);color:var(--accent);font-weight:600}
.navIc{width:16px;text-align:center;opacity:.9;flex-shrink:0}
.sideFoot{display:flex;gap:8px;padding-top:12px;border-top:1px solid var(--line)}
.sideFoot select{flex:1;background:var(--bg);border:1px solid var(--line);color:var(--text);border-radius:8px;padding:6px 8px}

.main{flex:1;min-width:0;display:flex;flex-direction:column}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:14px 28px;
  border-bottom:1px solid var(--line);background:var(--surface);position:sticky;top:0;z-index:5}
.topbar h1{font-family:'Sora';font-size:18px;font-weight:600;margin:0}
.userChip{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13px}
.avatar{width:28px;height:28px;border-radius:50%;background:var(--accent);color:#fff;
  display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:600}
.notifDot{background:#E0703A;color:#fff;border-radius:999px;font-size:10px;font-weight:700;
  padding:2px 7px}

.content{padding:24px 28px;max-width:1240px;width:100%;margin:0 auto}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.span2{grid-column:span 2}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px}
.cardTitle{font-family:'Sora';font-weight:600;font-size:15px;margin-bottom:4px}
.cardSub{color:var(--muted);font-size:12px;margin-bottom:12px}
.muted{color:var(--muted)} .small{font-size:12px}

.kpi{padding:14px 16px}
.kpiTop{display:flex;justify-content:space-between;align-items:center}
.kpiVal{font-family:'Sora';font-size:26px;font-weight:700;margin:4px 0 6px}
.delta{font-size:11.5px;font-weight:600;border-radius:6px;padding:2px 7px}
.delta.good{color:#2FA98C;background:rgba(47,169,140,.12)}
.delta.bad{color:#E0703A;background:rgba(224,112,58,.12)}

.ringWrap{display:flex;align-items:center;gap:24px;flex-wrap:wrap}
.ringNum{font-family:'Sora';font-size:44px;font-weight:700;fill:var(--text)}
.ringSub{font-size:12px;fill:var(--muted)}
.ringLegend{flex:1;min-width:180px;display:flex;flex-direction:column;gap:7px}
.legendRow{display:flex;align-items:center;gap:8px;font-size:13px}
.dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.legendLabel{flex:1;color:var(--muted)} .legendVal{font-weight:600;font-variant-numeric:tabular-nums}

.funnelRow{display:flex;align-items:center;gap:10px;margin-bottom:9px;font-size:12.5px}
.funnelLabel{width:70px;color:var(--muted)} .funnelVal{width:40px;text-align:right;font-weight:600}
.bar{height:7px;border-radius:4px;background:var(--ring-track);overflow:hidden;flex:1}
.barFill{height:100%;background:var(--accent);border-radius:4px;transition:width .6s ease}
.rec{padding:7px 0;border-bottom:1px solid var(--line);font-size:13px;line-height:1.45}
.rec:last-child{border:none}
.alertIc{color:#E0703A}
.row{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--line);font-size:13px}
.row:last-child{border:none}
.pill{background:var(--accent-soft);color:var(--accent);border-radius:6px;font-size:11px;font-weight:600;padding:2px 7px;flex-shrink:0}
.quickGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}

.ceoShell{max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.ceoHead{display:flex;align-items:center;gap:14px}
.ceoAvatar{width:44px;height:44px;border-radius:12px;background:var(--accent);color:#fff;
  display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.chip.big{padding:9px 16px;font-size:13px;display:inline-flex;align-items:center;gap:8px}

.agentShell{display:grid;grid-template-columns:190px 1fr;gap:14px}
.agentRail{display:flex;flex-direction:column;gap:2px;background:var(--surface);
  border:1px solid var(--line);border-radius:14px;padding:8px;height:fit-content;max-height:calc(100vh - 140px);overflow-y:auto}
.agentBtn{display:flex;align-items:center;gap:9px;padding:7px 9px;border:none;background:none;
  color:var(--muted);border-radius:8px;text-align:left;font-size:13px}
.agentBtn:hover{background:var(--bg);color:var(--text)}
.agentBtn.active{background:var(--accent-soft);color:var(--accent);font-weight:600}
.agentIc{width:15px;text-align:center} .agentCount{margin-left:auto;font-size:10.5px;background:var(--ring-track);border-radius:999px;padding:1px 6px}

.chatShell{display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.chatScroll{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:10px}
.chatEmpty{margin:auto;text-align:center;color:var(--muted);max-width:420px}
.chips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.chip{background:var(--surface);border:1px solid var(--line);color:var(--text);border-radius:999px;padding:6px 12px;font-size:12.5px}
.chip:hover{border-color:var(--accent);color:var(--accent)}
.chip:disabled{opacity:.6}
.bubble{max-width:78%;padding:10px 14px;border-radius:14px;white-space:pre-wrap;line-height:1.5;font-size:13.5px}
.bubble.user{align-self:flex-end;background:var(--accent);color:#fff;border-bottom-right-radius:4px}
.bubble.assistant{align-self:flex-start;background:var(--bg);border:1px solid var(--line);border-bottom-left-radius:4px}
.chatInput{display:flex;gap:8px;padding:12px;border-top:1px solid var(--line)}
.chatInput input{flex:1;background:var(--bg);border:1px solid var(--line);color:var(--text);border-radius:10px;padding:10px 14px;outline:none}
.chatInput input:focus{border-color:var(--accent)}

.primary{background:var(--accent);color:#fff;border:none;border-radius:10px;padding:9px 18px;
  font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:8px}
.primary:disabled{opacity:.6;cursor:default}
.ghost{background:none;border:1px solid var(--line);color:var(--text);border-radius:10px;padding:8px 14px}
.ghost:hover{border-color:var(--accent);color:var(--accent)}
.wide{width:100%;margin-top:14px}
.mini{background:var(--bg);border:1px solid var(--line);color:var(--muted);border-radius:7px;
  padding:3px 8px;font-size:11.5px;display:inline-flex;align-items:center;gap:5px}
.mini:hover{color:var(--accent);border-color:var(--accent)} .mini:disabled{opacity:.4}

.genShell{display:grid;grid-template-columns:320px 1fr;gap:16px;align-items:start}
.field{display:flex;flex-direction:column;gap:5px;margin-bottom:12px;font-size:12.5px;color:var(--muted)}
.field input,.field select{background:var(--bg);border:1px solid var(--line);color:var(--text);border-radius:9px;padding:9px 11px;outline:none}
.field input:focus{border-color:var(--accent)}
.output{white-space:pre-wrap;line-height:1.55;font-size:13.5px}
.spinner{width:13px;height:13px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;display:inline-block;animation:spin .7s linear infinite;vertical-align:-2px}
@keyframes spin{to{transform:rotate(360deg)}}

.crmTop{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:12px;flex-wrap:wrap}
.crmAdd{display:flex;gap:8px}
.crmAdd input{background:var(--surface);border:1px solid var(--line);color:var(--text);border-radius:9px;padding:8px 11px;outline:none;width:240px}
.kanban{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.kanbanCol{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:10px;min-height:120px}
.kanbanHead{font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;display:flex;justify-content:space-between}
.dealCard{padding:11px 12px;margin-bottom:8px}
.dealName{font-weight:600;font-size:13px;margin-bottom:3px;line-height:1.35}
.dealBtns{display:flex;gap:5px;margin-top:8px;justify-content:space-between}

.calGrid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
.calCell{border:1px solid var(--line);border-radius:8px;min-height:56px;padding:4px 5px;font-size:10.5px;cursor:pointer}
.calCell:hover{border-color:var(--accent)}
.calCell.has{background:var(--accent-soft)}
.calDay{color:var(--muted);font-size:10px}
.calPost{background:var(--accent);color:#fff;border-radius:5px;padding:1px 4px;margin-top:3px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.schedRow{display:flex;gap:8px;margin-top:12px}
.schedRow select{flex:1;background:var(--bg);border:1px solid var(--line);color:var(--text);border-radius:9px;padding:8px}

.ruleRow{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--line)}
.ruleTxt{font-size:13px;line-height:1.6}
.toggle{width:36px;height:20px;border-radius:999px;background:var(--ring-track);border:none;position:relative;flex-shrink:0;transition:background .2s}
.toggle.on{background:var(--accent)}
.knob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s}
.toggle.on .knob{left:18px}
.ruleBuilder{display:flex;align-items:center;gap:8px;margin-top:14px;flex-wrap:wrap}
.ruleBuilder select{background:var(--bg);border:1px solid var(--line);color:var(--text);border-radius:9px;padding:7px 9px;font-size:12.5px;max-width:220px}

.auditScores{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:10px}
.auditCell{text-align:center;padding:12px 8px}

.plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
.hotPlan{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.planName{font-family:'Sora';font-weight:600}
.planPrice{font-family:'Sora';font-size:26px;font-weight:700;margin:8px 0 12px}
.planFeats{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:7px;font-size:12.5px;color:var(--muted)}
.planFeats li::before{content:"✓ ";color:var(--accent)}

@media(max-width:960px){
  .side{width:62px;padding:14px 8px}
  .logoTxt,.taglineTxt,.navLabel,.navGroup,.chipTxt{display:none}
  .logo{justify-content:center} .logoMark{font-size:18px}
  .navBtn{justify-content:center;padding:9px 0;gap:0}
  .navIc{font-size:15px}
  .sideFoot{flex-direction:column}
  .genShell,.agentShell{grid-template-columns:1fr}
  .kanban{grid-template-columns:repeat(2,1fr)}
  .span2{grid-column:span 1}
  .content{padding:16px}
}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;
