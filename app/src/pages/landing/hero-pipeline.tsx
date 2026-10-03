import type { CSSProperties } from "react";
import { Brain, Clock, Eye, Mail, MapPin, MessageSquare, Search, Send, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { CountUp } from "./motion";
import { STAGE_MS, STAGES, type HeroStage } from "./hero-stage";

/* ─── Data ────────────────────────────────────────────────────────────────── */

type Tone = "acc" | "vio" | "grn" | "mu";

const LEADS: {
  name: string;
  initials: string;
  title: string;
  company: string;
  source: "LI" | "GM" | "GEMI";
  score: number;
  avatar: string;
  status: { label: string; icon: LucideIcon; tone: Tone };
}[] = [
  { name: "Sarah Chen", initials: "SC", title: "CTO", company: "DataFlow Inc", source: "LI", score: 94, avatar: "--lf-acc", status: { label: "Replied", icon: MessageSquare, tone: "grn" } },
  { name: "Marcus Webb", initials: "MW", title: "VP Engineering", company: "CloudScale", source: "LI", score: 87, avatar: "--lf-vio", status: { label: "Opened", icon: Eye, tone: "acc" } },
  { name: "Elena Papadopoulou", initials: "EP", title: "Owner", company: "Aegean Travel Co", source: "GEMI", score: 85, avatar: "--lf-grn", status: { label: "Sent", icon: Mail, tone: "mu" } },
  { name: "Priya Nair", initials: "PN", title: "Head of Product", company: "Nexus AI", source: "GM", score: 82, avatar: "--lf-ylw", status: { label: "Queued", icon: Clock, tone: "mu" } },
];

const SOURCE_STYLE: Record<"LI" | "GM" | "GEMI", { bg: string; c: string; bd: string }> = {
  LI: { bg: "var(--lf-li-bg)", c: "var(--lf-li-c)", bd: "var(--lf-li-bd)" },
  GM: { bg: "var(--lf-gm-bg)", c: "var(--lf-gm-c)", bd: "var(--lf-gm-bd)" },
  GEMI: { bg: "var(--lf-vio-bg)", c: "var(--lf-vio-lt)", bd: "var(--lf-vio-bd)" },
};

const TONE_STYLE: Record<Tone, CSSProperties> = {
  acc: { backgroundColor: "var(--lf-acc-bg)", color: "var(--lf-acc-lt)", border: "1px solid var(--lf-acc-bd-sm)" },
  vio: { backgroundColor: "var(--lf-vio-bg)", color: "var(--lf-vio-lt)", border: "1px solid var(--lf-vio-bd)" },
  grn: { backgroundColor: "var(--lf-grn-bg)", color: "var(--lf-grn-lt)", border: "1px solid var(--lf-grn-bd)" },
  mu: { backgroundColor: "var(--lf-ghost)", color: "var(--lf-mu)", border: "1px solid var(--lf-ghost-bd)" },
};

const mono = { fontFamily: "ui-monospace, Consolas, monospace" } as const;

const STATUS_LINE = ["running", "scoring", "outreach live"];

const FOOTER: { icon: LucideIcon; tone: string; text: string }[] = [
  { icon: Search, tone: "var(--lf-acc)", text: "Scanning LinkedIn, Google Maps, GEMI" },
  { icon: Sparkles, tone: "var(--lf-vio)", text: "AI scoring against your ICP" },
  { icon: Send, tone: "var(--lf-grn)", text: "Sequence: Email, LinkedIn, SMS" },
];

/* ─── Component ───────────────────────────────────────────────────────────── */

export function HeroTerminal({ stage, tick, cycle, go }: HeroStage) {
  const Footer = FOOTER[stage];

  return (
    <div className="relative w-full max-w-2xl lf-float" style={{ "--lf-stage-ms": `${STAGE_MS}ms` } as CSSProperties}>
      {/* Ambient glow behind the card */}
      <div className="absolute pointer-events-none" style={{ inset: "-40px", background: "radial-gradient(ellipse, var(--lf-hero-glow) 0%, transparent 70%)", filter: "blur(10px)" }} />

      <div className="relative rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--lf-sur)", border: "1px solid var(--lf-acc-bd)", boxShadow: "var(--lf-term-sh)" }}>
        <div className="lf-scan-beam" />

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--lf-acc-bd-sm)", backgroundColor: "var(--lf-inset)" }}>
          <div className="flex gap-1.5">
            {["rgba(239,68,68,0.55)", "rgba(234,179,8,0.55)", "rgba(34,197,94,0.55)"].map((c) => (
              <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
            ))}
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="lf-pulse-dot w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "var(--lf-grn)", borderRadius: "9999px" }} />
            <span className="truncate text-[11px]" style={{ ...mono, color: "var(--lf-mu)" }}>
              filter:SaaS-Founders · {STATUS_LINE[stage]}
            </span>
          </div>
          <span className="shrink-0 text-[11px] font-semibold" style={{ ...mono, color: "var(--lf-acc)" }}>
            <CountUp key={cycle} to={247} immediate duration={1800} /> leads
          </span>
        </div>

        {/* Stage tabs */}
        <div role="tablist" aria-label="How it works" className="grid grid-cols-3 border-b" style={{ borderColor: "var(--lf-acc-bd-sm)" }}>
          {STAGES.map(({ key, label, icon: Icon }, i) => {
            const active = i === stage;
            return (
              <button key={key} role="tab" type="button" aria-selected={active} onClick={() => go(i)} className={`lf-tab${active ? " lf-tab-on" : ""}`}>
                <Icon className="w-3.5 h-3.5" />
                {label}
                {active && <span key={tick} className="lf-tab-bar" />}
              </button>
            );
          })}
        </div>

        {/* Lead rows */}
        <div key={cycle} className="p-3 space-y-2">
          {LEADS.map((lead, i) => {
            const src = SOURCE_STYLE[lead.source];
            const StatusIcon = lead.status.icon;
            return (
              <div
                key={lead.name}
                className="lf-row flex items-center gap-3 p-2.5 rounded-xl"
                style={{ backgroundColor: "var(--lf-row-bg)", border: "1px solid var(--lf-row-bd)", animationDelay: `${0.15 + i * 0.28}s` }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: `color-mix(in oklch, var(${lead.avatar}) 20%, transparent)`, color: `var(${lead.avatar})` }}
                >
                  {lead.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--lf-tx)" }}>
                    {lead.name}
                  </p>
                  <p className="text-xs truncate" style={{ color: "var(--lf-mu)" }}>
                    {lead.title} · {lead.company}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0" style={{ backgroundColor: src.bg, color: src.c, border: `1px solid ${src.bd}` }}>
                  {lead.source}
                </span>

                {/* Right cell changes with the stage */}
                <div key={stage} className="lf-swap w-[96px] flex justify-end shrink-0">
                  {stage === 0 && <span className="lf-skel" aria-hidden="true" style={{ animationDelay: `${i * 0.2}s` }} />}
                  {stage === 1 && (
                    <span className="text-sm font-bold" style={{ color: lead.score >= 90 ? "var(--lf-grn-lt)" : lead.score >= 85 ? "var(--lf-acc)" : "var(--lf-ylw)" }}>
                      <CountUp to={lead.score} immediate duration={900 + i * 120} />
                    </span>
                  )}
                  {stage === 2 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md" style={TONE_STYLE[lead.status.tone]}>
                      <StatusIcon className="w-3 h-3" />
                      {lead.status.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t" style={{ borderColor: "var(--lf-acc-bd-sm)", backgroundColor: "var(--lf-inset)" }}>
          <div className="flex items-center gap-2">
            <Footer.icon className="w-3.5 h-3.5 shrink-0" style={{ color: Footer.tone }} />
            <span key={stage} className="lf-swap text-xs truncate flex-1" style={{ color: "var(--lf-mu)" }}>
              {Footer.text}
            </span>
          </div>
          <div className="mt-2.5 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--lf-shimmer)" }}>
            <div key={tick} className="lf-fill h-full rounded-full" style={{ background: "linear-gradient(90deg, var(--lf-acc), var(--lf-vio))" }} />
          </div>
        </div>
      </div>

      {/* Floating chip: what just happened */}
      <div className="absolute -right-2 sm:-right-5 -bottom-5 lf-float-alt">
        <div key={stage} className="lf-pop rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: "var(--lf-sur)", border: "1px solid var(--lf-grn-bd-lg)", boxShadow: "var(--lf-float-sh)", minWidth: "170px" }}>
          <FloatChip stage={stage} />
        </div>
      </div>

      {/* Floating chip: deliverability */}
      <div className="hidden sm:block absolute -left-5 top-24 lf-float-alt" style={{ animationDelay: "0s" }}>
        <div className="rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: "var(--lf-sur)", border: "1px solid var(--lf-acc-bd)", boxShadow: "var(--lf-float-sh)", minWidth: "160px" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--lf-acc-bg)" }}>
            <ShieldCheck className="w-4 h-4" style={{ color: "var(--lf-acc)" }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--lf-tx)", lineHeight: 1.15 }}>
              Email validated
            </p>
            <p className="text-xs" style={{ color: "var(--lf-mu)" }}>
              before every send
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatChip({ stage }: { stage: number }) {
  const chips = [
    { icon: MapPin, title: "+12 new leads", sub: "from Google Maps", c: "--lf-acc", bg: "--lf-acc-bg" },
    { icon: Brain, title: "247 scored", sub: "against your ICP", c: "--lf-vio", bg: "--lf-vio-bg" },
    { icon: MessageSquare, title: "Reply received", sub: "Sarah Chen, CTO", c: "--lf-grn", bg: "--lf-grn-bg" },
  ];
  const { icon: Icon, title, sub, c, bg } = chips[stage];
  return (
    <>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `var(${bg})` }}>
        <Icon className="w-4 h-4" style={{ color: `var(${c})` }} />
      </div>
      <div>
        <p className="text-sm font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--lf-tx)", lineHeight: 1.15 }}>
          {title}
        </p>
        <p className="text-xs" style={{ color: "var(--lf-mu)" }}>
          {sub}
        </p>
      </div>
    </>
  );
}
