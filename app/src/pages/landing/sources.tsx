import { ArrowDown, Bot, Building2, Globe, Landmark, Mail, MapPin, Phone, Send, Sparkles, type LucideIcon } from "lucide-react";
import { environments } from "@/config/environments";
import { Reveal } from "./motion";

/* ─── Data ────────────────────────────────────────────────────────────────── */

type SourceKey = "LI" | "GM" | "GEMI";

const SOURCES: { key: SourceKey; icon: LucideIcon; name: string; kicker: string; body: string; fields: string[]; accent: string }[] = [
  {
    key: "LI",
    icon: Globe,
    name: "LinkedIn",
    kicker: "People",
    body: "Decision makers by job title, seniority and industry.",
    fields: ["Job title", "Seniority", "Company"],
    accent: "--lf-li-c",
  },
  {
    key: "GM",
    icon: MapPin,
    name: "Google Maps",
    kicker: "Local businesses",
    body: "Shops, clinics, hotels and agencies in any area.",
    fields: ["Phone", "Website", "Rating"],
    accent: "--lf-gm-c",
  },
  {
    key: "GEMI",
    icon: Landmark,
    name: "GEMI Registry",
    kicker: "Official Greek records",
    body: "Verified company data from the national registry.",
    fields: ["Legal form", "Region", "Activity"],
    accent: "--lf-vio-lt",
  },
];

const BADGE: Record<SourceKey, { bg: string; c: string; bd: string }> = {
  LI: { bg: "var(--lf-li-bg)", c: "var(--lf-li-c)", bd: "var(--lf-li-bd)" },
  GM: { bg: "var(--lf-gm-bg)", c: "var(--lf-gm-c)", bd: "var(--lf-gm-bd)" },
  GEMI: { bg: "var(--lf-vio-bg)", c: "var(--lf-vio-lt)", bd: "var(--lf-vio-bd)" },
};

const MERGED: { name: string; sub: string; source: SourceKey; score: number }[] = [
  { name: "Sarah Chen", sub: "CTO · DataFlow Inc", source: "LI", score: 94 },
  { name: "Elena Papadopoulou", sub: "Owner · Aegean Travel Co", source: "GEMI", score: 91 },
  { name: "Athens Dental Studio", sub: "Dental clinic · Athens", source: "GM", score: 88 },
  { name: "Marcus Webb", sub: "VP Engineering · CloudScale", source: "LI", score: 87 },
  { name: "Nea Paralia Hotel", sub: "Hotel · Thessaloniki", source: "GM", score: 83 },
];

const INTEGRATIONS: { icon: LucideIcon; label: string }[] = [
  { icon: Bot, label: "OpenAI and Anthropic" },
  { icon: Mail, label: "Resend and SMTP" },
  { icon: Phone, label: "Twilio SMS" },
  { icon: Building2, label: "HubSpot CRM" },
];

const scoreColor = (n: number) => (n >= 90 ? "var(--lf-grn-lt)" : n >= 85 ? "var(--lf-acc)" : "var(--lf-ylw)");

/* ─── Left: one source ────────────────────────────────────────────────────── */

function SourceCard({ source, index }: { source: (typeof SOURCES)[number]; index: number }) {
  const { icon: Icon, name, kicker, body, fields, accent } = source;
  return (
    <Reveal delay={index * 130} className="h-full">
      <div className="lf-card-hover lf-src h-full rounded-2xl p-5 flex items-center gap-4" style={{ backgroundColor: "var(--lf-sur)", border: "1px solid var(--lf-acc-bd-sm)", ["--lf-src" as string]: `var(${accent})` }}>
        <span className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `color-mix(in oklch, var(${accent}) 14%, transparent)`, border: `1px solid color-mix(in oklch, var(${accent}) 30%, transparent)` }}>
          <Icon className="w-5 h-5" style={{ color: `var(${accent})` }} />
        </span>
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "17px", color: "var(--lf-tx)" }}>{name}</h3>
            <span className="text-xs font-semibold" style={{ color: `var(${accent})` }}>
              {kicker}
            </span>
          </div>
          <p className="text-[18px] leading-snug" style={{ color: "var(--lf-mu)" }}>
            {body}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {fields.map((f) => (
              <span key={f} className="text-[11px] px-2 py-0.5 rounded-md" style={{ backgroundColor: "var(--lf-ghost)", border: "1px solid var(--lf-ghost-bd)", color: "var(--lf-mu)" }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/* ─── Middle: streams converging ──────────────────────────────────────────── */

function Streams() {
  // 3 equal rows: centres at 1/6, 3/6, 5/6 of the height. Everything meets at the middle.
  const ys = [16.66, 50, 83.33];
  return (
    <Reveal className="hidden lg:block h-full" style={{ transitionDelay: "300ms" }}>
      <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {ys.map((y, i) => (
          <g key={y}>
            <path d={`M0 ${y} C 55 ${y}, 45 50, 100 50`} fill="none" stroke="var(--lf-acc-bd)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            <path className="lf-stream" d={`M0 ${y} C 55 ${y}, 45 50, 100 50`} fill="none" stroke="var(--lf-acc)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 14" vectorEffect="non-scaling-stroke" style={{ animationDelay: `${i * 0.45}s` }} />
          </g>
        ))}
      </svg>
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--lf-sur)", border: "1px solid var(--lf-vio-bd-lg)" }}>
        <Sparkles className="w-4 h-4" style={{ color: "var(--lf-vio)" }} />
      </span>
    </Reveal>
  );
}

/* ─── Right: merged, scored lead list ─────────────────────────────────────── */

function MergedList() {
  return (
    <Reveal delay={200} className="h-full">
      <div className="h-full rounded-2xl overflow-hidden flex flex-col" style={{ backgroundColor: "var(--lf-sur)", border: "1px solid var(--lf-acc-bd)", boxShadow: "var(--lf-term-sh)" }}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--lf-acc-bd-sm)", backgroundColor: "var(--lf-inset)" }}>
          <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--lf-tx)" }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--lf-vio)" }} />
            One lead list
          </span>
          <span className="text-[11px]" style={{ fontFamily: "ui-monospace, Consolas, monospace", color: "var(--lf-mu)" }}>
            deduplicated · scored
          </span>
        </div>

        <div className="p-3 space-y-2 flex-1 flex flex-col justify-center">
          {MERGED.map((lead, i) => {
            const b = BADGE[lead.source];
            return (
              <div key={lead.name} className="lf-row flex items-center gap-3 p-2.5 rounded-xl" style={{ backgroundColor: "var(--lf-row-bg)", border: "1px solid var(--lf-row-bd)", animationDelay: `${0.5 + i * 0.18}s` }}>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 w-11 text-center" style={{ backgroundColor: b.bg, color: b.c, border: `1px solid ${b.bd}` }}>
                  {lead.source}
                </span>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate leading-tight" style={{ color: "var(--lf-tx)" }}>
                      {lead.name}
                    </p>
                    <p className="text-xs truncate" style={{ color: "var(--lf-mu)" }}>
                      {lead.sub}
                    </p>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--lf-shimmer)" }}>
                    <div className="lf-bar h-full rounded-full" style={{ width: `${lead.score}%`, backgroundColor: scoreColor(lead.score), transitionDelay: `${700 + i * 180}ms` }} />
                  </div>
                </div>
                <span className="w-7 text-right text-sm font-bold shrink-0" style={{ color: scoreColor(lead.score) }}>
                  {lead.score}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5 px-4 py-3 border-t" style={{ borderColor: "var(--lf-acc-bd-sm)", backgroundColor: "var(--lf-inset)" }}>
          <Send className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--lf-grn)" }} />
          <span className="text-xs flex-1" style={{ color: "var(--lf-mu)" }}>
            Ready for sequences
          </span>
          {[Mail, Phone, Globe].map((Ic, i) => (
            <span key={i} className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: "var(--lf-grn-bg)" }}>
              <Ic className="w-3 h-3" style={{ color: "var(--lf-grn)" }} />
            </span>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

/* ─── Section ─────────────────────────────────────────────────────────────── */

export function SourcesSection() {
  return (
    <section id="integrations" className="lf-wrap mx-auto px-6 pb-24 scroll-mt-20">
      <Reveal className="text-center space-y-3 mb-14">
        <p className="text-xs font-semibold" style={{ color: "var(--lf-acc)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Finds leads from
        </p>
        <h2 style={{ fontFamily: "'Syne', system-ui, sans-serif", fontWeight: 700, fontSize: "clamp(28px,4vw,44px)", color: "var(--lf-tx)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Three sources.
          <br />
          <span className="lf-accent-text">One scored pipeline.</span>
        </h2>
        <p className="text-[18px] max-w-xl mx-auto" style={{ color: "var(--lf-mu)" }}>
          {environments.APP_NAME} pulls from the places your customers actually are, then merges everything into a single ranked list.
        </p>
      </Reveal>

      <div className="relative grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_110px_minmax(0,1fr)] items-stretch gap-4 lg:gap-0">
        <div className="grid grid-rows-3 gap-4">
          {SOURCES.map((s, i) => (
            <SourceCard key={s.key} source={s} index={i} />
          ))}
        </div>

        <div className="relative flex items-center justify-center lg:block">
          <ArrowDown className="lg:hidden w-5 h-5" style={{ color: "var(--lf-acc-bd-lg)" }} />
          <Streams />
        </div>

        <MergedList />
      </div>

      <Reveal delay={300} className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
        <span className="text-xs font-semibold" style={{ color: "var(--lf-mu)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Works with
        </span>
        {INTEGRATIONS.map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--lf-mu)" }}>
            <Icon className="w-4 h-4" style={{ color: "var(--lf-acc)" }} />
            {label}
          </span>
        ))}
      </Reveal>
    </section>
  );
}
