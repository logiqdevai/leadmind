import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
	ArrowRight,
	Bell,
	Brain,
	CheckCircle2,
	FileText,
	Filter,
	Layers,
	Moon,
	Search,
	Sparkles,
	Sun,
	TrendingUp,
	Workflow,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { Routes } from '@/routes/routes';
import './landing.css';
import { environments } from '@/config/environments';
import { AppLogo } from '@/components/layout/app-logo';
import { HeroTerminal } from './hero-pipeline';
import { STAGES, useHeroStage } from './hero-stage';
import { CountUp, Reveal } from './motion';
import { SourcesSection } from './sources';

/* ─── Theme hook ──────────────────────────────────────────────────────────── */

function useLandingTheme() {
	const [isDark, setIsDark] = useState<boolean>(() => {
		try {
			return localStorage.getItem('theme') !== 'light';
		} catch {
			return true;
		}
	});

	const toggle = () =>
		setIsDark((prev) => {
			const next = !prev;
			try {
				localStorage.setItem('theme', next ? 'dark' : 'light');
				document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
			} catch {}
			return next;
		});

	return { isDark, toggle };
}

/* ─── Static data ─────────────────────────────────────────────────────────── */

type Variant = 'blue' | 'violet' | 'green';

const VARIANT_CSS: Record<Variant, { color: string; bg: string; bd: string; bdLg: string; wm: string; step: string }> =
	{
		blue: {
			color: '--lf-acc',
			bg: '--lf-acc-bg',
			bd: '--lf-acc-bd',
			bdLg: '--lf-acc-bd-lg',
			wm: '--lf-acc-wm',
			step: '--lf-acc-step',
		},
		violet: {
			color: '--lf-vio',
			bg: '--lf-vio-bg',
			bd: '--lf-vio-bd',
			bdLg: '--lf-vio-bd-lg',
			wm: '--lf-vio-wm',
			step: '--lf-vio-step',
		},
		green: {
			color: '--lf-grn',
			bg: '--lf-grn-bg',
			bd: '--lf-grn-bd',
			bdLg: '--lf-grn-bd-lg',
			wm: '--lf-grn-wm',
			step: '--lf-grn-step',
		},
	};

const v = (name: string) => `var(${name})`;

const FEATURES: { icon: typeof Search; variant: Variant; title: string; description: string; bullets: string[] }[] = [
	{
		icon: Search,
		variant: 'blue',
		title: 'Lead discovery from every angle',
		description: `Set your filters once and ${environments.APP_NAME} scrapes qualified leads from LinkedIn, Google Maps and Greece's official GEMI business registry, on your schedule.`,
		bullets: ['LinkedIn and Google Maps scraping', 'Official GEMI registry lookup', 'Scheduled and on-demand runs'],
	},
	{
		icon: Brain,
		variant: 'violet',
		title: 'AI enrichment and scoring',
		description:
			'Every lead is enriched from multiple sources and scored against your ideal customer profile, so your team always knows who to contact first.',
		bullets: ['Multi-source AI enrichment', 'Custom ICP scoring instructions', 'Priority inbox for high-fit leads'],
	},
	{
		icon: Workflow,
		variant: 'green',
		title: 'AI-personalised sequences',
		description:
			'Build multi-step email, SMS and LinkedIn sequences with AI-drafted messages written for each contact. Enroll one lead at a time or in bulk.',
		bullets: ['Multi-step drip sequences', 'AI-personalised messaging', 'Bulk and single enrollment'],
	},
	{
		icon: Layers,
		variant: 'blue',
		title: 'Powerful segmentation',
		description:
			'Group contacts into lists, save dynamic filters as reusable segments, and get instant AI-generated audience insights for any slice of your pipeline.',
		bullets: ['Contact lists and saved filters', 'AI audience analysis', 'Fast full-text search'],
	},
];

const STEPS: { num: string; icon: typeof Filter; variant: Variant; title: string; body: string }[] = [
	{
		num: '01',
		icon: Filter,
		variant: 'blue',
		title: 'Tell it who to find',
		body: 'Pick a job title, location, industry and company size, then choose a source: LinkedIn, Google Maps or the GEMI registry.',
	},
	{
		num: '02',
		icon: Sparkles,
		variant: 'violet',
		title: 'AI enriches and scores',
		body: 'Your filter runs on schedule. Every prospect is scraped, enriched from multiple sources and scored against your ideal customer.',
	},
	{
		num: '03',
		icon: TrendingUp,
		variant: 'green',
		title: 'Sequences reach out',
		body: 'Scored leads enter AI-personalised sequences across email, SMS and LinkedIn, paced safely and tracked through your pipeline.',
	},
];

/* ─── Root ────────────────────────────────────────────────────────────────── */

export default function LandingPage() {
	const { isLoggedIn: rawLoggedIn } = useAuthStore();
	const isLoggedIn = Boolean(rawLoggedIn);
	const { isDark, toggle } = useLandingTheme();

	return (
		<div
			className={`lf-root h-full overflow-y-auto overflow-x-hidden${isDark ? '' : ' lf-light'}`}
			style={{
				backgroundColor: 'var(--lf-bg)',
				fontFamily: "'DM Sans', system-ui, sans-serif",
				color: 'var(--lf-tx)',
			}}
		>
			{/* Fixed ambient layer */}
			<div className="lf-grid-bg fixed inset-0 pointer-events-none z-0" />
			<div
				className="fixed pointer-events-none z-0"
				style={{
					top: '-300px',
					left: '-200px',
					width: '900px',
					height: '900px',
					background: `radial-gradient(ellipse, var(--lf-acc-glow) 0%, transparent 65%)`,
				}}
			/>
			<div
				className="fixed pointer-events-none z-0"
				style={{
					bottom: '-300px',
					right: '-200px',
					width: '900px',
					height: '900px',
					background: `radial-gradient(ellipse, var(--lf-vio-glow) 0%, transparent 65%)`,
				}}
			/>

			<div className="relative z-10">
				<LandingNav isLoggedIn={isLoggedIn} isDark={isDark} toggle={toggle} />
				<HeroSection isLoggedIn={isLoggedIn} />
				<SourcesSection />
				<HowItWorksSection />
				<FeaturesSection />
				<DeliverabilitySection />
				<LeadCaptureSection />
				<CTASection isLoggedIn={isLoggedIn} />
				<LandingFooter />
			</div>
		</div>
	);
}

/* ─── Nav ─────────────────────────────────────────────────────────────────── */

function LandingNav({ isLoggedIn, isDark, toggle }: { isLoggedIn: boolean; isDark: boolean; toggle: () => void }) {
	return (
		<nav
			className="sticky top-0 z-50 border-b"
			style={{
				backgroundColor: 'var(--lf-nav-bg)',
				backdropFilter: 'blur(14px)',
				WebkitBackdropFilter: 'blur(14px)',
				borderColor: 'var(--lf-nav-bd)',
			}}
		>
			<div className="lf-wrap mx-auto px-6 h-16 flex items-center justify-between gap-6">
				<Link to="/" className="flex items-center gap-2.5 shrink-0" style={{ textDecoration: 'none' }}>
					<AppLogo className="h-7 w-7" style={{ color: 'var(--lf-acc)' }} />
					<span
						style={{
							fontFamily: "'Syne', system-ui, sans-serif",
							fontWeight: 700,
							fontSize: '17px',
							color: 'var(--lf-tx)',
							letterSpacing: '-0.01em',
						}}
					>
						{environments.APP_NAME}
					</span>
				</Link>

				<div className="hidden md:flex items-center gap-7">
					{['How it works', 'Features', 'Integrations'].map((label) => (
						<a key={label} href={`#${label.toLowerCase().replace(/\s+/g, '-')}`} className="lf-nav-link">
							{label}
						</a>
					))}
				</div>

				<div className="flex items-center gap-2 shrink-0">
					<button
						onClick={toggle}
						className="lf-theme-btn"
						aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
					>
						{isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
					</button>

					{isLoggedIn ? (
						<Link to={Routes.dashboard.root} className="lf-btn-primary lf-sm">
							Go to Dashboard
							<ArrowRight className="w-3.5 h-3.5" />
						</Link>
					) : (
						<>
							<Link to={Routes.auth.sign_in} className="lf-btn-text">
								Sign in
							</Link>
							<Link to={Routes.auth.sign_up} className="lf-btn-primary lf-sm">
								Get started free
							</Link>
						</>
					)}
				</div>
			</div>
		</nav>
	);
}

/* ─── Hero ────────────────────────────────────────────────────────────────── */

const HEADLINE: { verb: string; rest: string }[] = [
	{ verb: 'Find', rest: ' leads.' },
	{ verb: 'Score', rest: ' them with AI.' },
	{ verb: 'Reach out', rest: ' automatically.' },
];

function HeroSection({ isLoggedIn }: { isLoggedIn: boolean }) {
	const hero = useHeroStage();

	return (
		<section className="lf-wrap lf-hero mx-auto px-6 pt-20 pb-24 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,640px)] gap-16 lg:gap-12 items-center">
			<div className="space-y-8 max-w-2xl">
				<h1 className="lf-h1" aria-label="Find leads. Score them with AI. Reach out automatically.">
					{HEADLINE.map(({ verb, rest }, i) => (
						<span key={verb} aria-hidden="true" className={`lf-clause${hero.stage === i ? ' lf-on' : ''}`}>
							<span className="lf-verb">{verb}</span>
							{rest}
						</span>
					))}
				</h1>

				<p className="text-[18px] leading-relaxed" style={{ color: 'var(--lf-mu)', maxWidth: '52ch' }}>
					{environments.APP_NAME} finds prospects on LinkedIn, Google Maps and Greece's GEMI business registry,
					ranks them against your ideal customer with AI, then runs personalised email, SMS and LinkedIn sequences
					for you.
				</p>

				<div className="flex flex-wrap gap-3">
					<Link
						to={isLoggedIn ? Routes.dashboard.root : Routes.auth.sign_up}
						className="lf-btn-primary"
						style={{ paddingLeft: '24px', paddingRight: '24px', paddingTop: '14px', paddingBottom: '14px' }}
					>
						{isLoggedIn ? 'Go to Dashboard' : 'Start finding leads'}
						<ArrowRight className="w-4 h-4" />
					</Link>
					<a href="#how-it-works" className="lf-btn-ghost">
						See how it works
					</a>
				</div>
			</div>

			<div className="flex justify-center lg:justify-end">
				<HeroTerminal {...hero} />
			</div>
		</section>
	);
}

/* ─── How it works ────────────────────────────────────────────────────────── */

function HowItWorksSection() {
	return (
		<section id="how-it-works" className="lf-wrap mx-auto px-6 py-24 scroll-mt-20">
			<Reveal>
				<SectionLabel variant="violet">How it works</SectionLabel>
				<SectionHeading>
					From zero to pipeline
					<br />
					<span className="lf-accent-text">in three steps</span>
				</SectionHeading>
			</Reveal>

			<div className="relative mt-20 grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
				<Reveal
					className="hidden md:block absolute top-7 left-[calc(16.66%+40px)] right-[calc(16.66%+40px)] h-px pointer-events-none lf-connector"
					style={{
						background: 'linear-gradient(90deg, var(--lf-acc-bd-lg), var(--lf-vio-bd-lg), var(--lf-grn-bd-lg))',
					}}
				/>

				{STEPS.map(({ num, icon: Icon, variant, title, body }, i) => {
					const cv = VARIANT_CSS[variant];
					return (
						<Reveal key={num} delay={i * 140} className="relative flex flex-col items-center text-center gap-4">
							<div className="relative w-full flex justify-center">
								<span
									className="absolute -top-6 select-none pointer-events-none"
									style={{
										fontFamily: "'Syne', sans-serif",
										fontWeight: 800,
										fontSize: '88px',
										color: v(cv.wm),
										lineHeight: 1,
										letterSpacing: '-0.04em',
									}}
								>
									{num}
								</span>
								<div
									className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
									style={{ backgroundColor: v(cv.bg), boxShadow: v(cv.step) }}
								>
									<Icon className="w-6 h-6" style={{ color: v(cv.color) }} />
								</div>
							</div>
							<h3
								style={{
									fontFamily: "'Syne', sans-serif",
									fontWeight: 700,
									fontSize: '18px',
									color: 'var(--lf-tx)',
								}}
							>
								{title}
							</h3>
							<p className="text-[18px] leading-relaxed max-w-sm" style={{ color: 'var(--lf-mu)' }}>
								{body}
							</p>
						</Reveal>
					);
				})}
			</div>
		</section>
	);
}

/* ─── Features ────────────────────────────────────────────────────────────── */

function FeatureCard({ icon: Icon, variant, title, description, bullets }: (typeof FEATURES)[number]) {
	const cv = VARIANT_CSS[variant];
	return (
		<div
			className="lf-card-hover h-full rounded-2xl p-7 flex flex-col gap-5"
			style={{ backgroundColor: 'var(--lf-sur)', border: `1px solid ${v(cv.bd)}` }}
		>
			<div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: v(cv.bg) }}>
				<Icon className="w-6 h-6" style={{ color: v(cv.color) }} />
			</div>
			<h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '20px', color: 'var(--lf-tx)' }}>
				{title}
			</h3>
			<p className="text-[18px] leading-relaxed" style={{ color: 'var(--lf-mu)' }}>
				{description}
			</p>
			<ul className="space-y-2.5 mt-auto">
				{bullets.map((b) => (
					<li key={b} className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--lf-mu)' }}>
						<CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: v(cv.color) }} />
						{b}
					</li>
				))}
			</ul>
		</div>
	);
}

function FeaturesSection() {
	return (
		<section id="features" className="lf-wrap mx-auto px-6 py-24 scroll-mt-20">
			<Reveal>
				<SectionLabel variant="blue">Platform</SectionLabel>
				<SectionHeading>
					Everything you need to fill
					<br />
					<span className="lf-accent-text">your pipeline</span>
				</SectionHeading>
				<p className="text-center text-[18px] mt-4 mb-16 max-w-2xl mx-auto" style={{ color: 'var(--lf-mu)' }}>
					From discovery to conversion, {environments.APP_NAME} handles the whole top of your funnel.
				</p>
			</Reveal>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				{FEATURES.map((f, i) => (
					<Reveal key={f.title} delay={(i % 2) * 120}>
						<FeatureCard {...f} />
					</Reveal>
				))}
			</div>
		</section>
	);
}

/* ─── Deliverability ──────────────────────────────────────────────────────── */

function DeliverabilitySection() {
	const gauges: { label: string; pct: number; variant: Variant }[] = [
		{ label: 'Email (Resend / SMTP)', pct: 78, variant: 'blue' },
		{ label: 'LinkedIn', pct: 52, variant: 'violet' },
		{ label: 'SMS (Twilio)', pct: 34, variant: 'green' },
	];

	return (
		<section className="lf-wrap mx-auto px-6 py-24">
			<div className="grid grid-cols-1 lg:grid-cols-[1fr_580px] gap-14 items-stretch">
				<Reveal className="space-y-6 max-w-2xl">
					<span className="lf-label lf-label-blue">Deliverability</span>

					<h2
						style={{
							fontFamily: "'Syne', system-ui, sans-serif",
							fontWeight: 700,
							fontSize: 'clamp(28px,4vw,44px)',
							color: 'var(--lf-tx)',
							letterSpacing: '-0.02em',
							lineHeight: 1.1,
						}}
					>
						Send at scale
						<br />
						<span className="lf-accent-text">without burning your reputation</span>
					</h2>

					<p className="text-[18px] leading-relaxed" style={{ color: 'var(--lf-mu)' }}>
						Stage-based sending policies and a real-time pacing engine spread volume across accounts and
						providers, so messages land in the inbox, not the spam folder.
					</p>
				</Reveal>

				<Reveal delay={150} className="h-full">
					<div
						className="rounded-2xl p-6 h-full flex flex-col justify-between gap-5"
						style={{
							backgroundColor: 'var(--lf-sur)',
							border: '1px solid var(--lf-acc-bd)',
							boxShadow: 'var(--lf-term-sh)',
						}}
					>
						<div className="flex items-center justify-between">
							<span className="text-sm font-semibold" style={{ color: 'var(--lf-tx)' }}>
								Sending capacity
							</span>
							<div className="flex items-center gap-2">
								<span
									className="lf-pulse-dot w-1.5 h-1.5 rounded-full shrink-0"
									style={{ backgroundColor: 'var(--lf-grn)', borderRadius: '9999px' }}
								/>
								<span className="text-xs" style={{ color: 'var(--lf-mu)' }}>
									Live
								</span>
							</div>
						</div>

						{gauges.map((g, i) => {
							const cv = VARIANT_CSS[g.variant];
							return (
								<div key={g.label} className="space-y-1.5">
									<div className="flex justify-between text-xs" style={{ color: 'var(--lf-mu)' }}>
										<span>{g.label}</span>
										<span>
											<CountUp to={g.pct} suffix="%" duration={1200} />
										</span>
									</div>
									<div
										className="h-2 rounded-full overflow-hidden"
										style={{ backgroundColor: 'var(--lf-shimmer)' }}
									>
										<div
											className="lf-bar h-full rounded-full"
											style={{
												width: `${g.pct}%`,
												backgroundColor: v(cv.color),
												transitionDelay: `${300 + i * 150}ms`,
											}}
										/>
									</div>
								</div>
							);
						})}
					</div>
				</Reveal>
			</div>
		</section>
	);
}

/* ─── Lead capture & follow-up ────────────────────────────────────────────── */

function LeadCaptureSection() {
	const cards: { icon: typeof FileText; variant: Variant; title: string; description: string; bullets: string[] }[] = [
		{
			icon: FileText,
			variant: 'blue',
			title: 'Lead capture forms',
			description:
				'Embed customisable lead-capture forms on your site and route every completion straight into your pipeline the moment it lands.',
			bullets: ['Embeddable, customisable forms', 'Instant real-time notifications'],
		},
		{
			icon: Bell,
			variant: 'green',
			title: 'Follow-up reminders',
			description:
				'Set reminders on any contact so a hot lead never goes cold, with real-time alerts the moment something needs your attention.',
			bullets: ['Reminders tied to contacts', 'Real-time alerts and notifications'],
		},
	];

	return (
		<section className="lf-wrap mx-auto px-6 py-24">
			<Reveal>
				<SectionLabel variant="green">Capture and follow-up</SectionLabel>
				<SectionHeading>
					Never miss a lead
					<br />
					<span className="lf-accent-text">or a follow-up</span>
				</SectionHeading>
			</Reveal>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16">
				{cards.map((c, i) => (
					<Reveal key={c.title} delay={i * 120}>
						<FeatureCard {...c} />
					</Reveal>
				))}
			</div>
		</section>
	);
}

/* ─── CTA ─────────────────────────────────────────────────────────────────── */

function CTASection({ isLoggedIn }: { isLoggedIn: boolean }) {
	return (
		<section className="lf-wrap mx-auto px-6 py-24">
			<Reveal>
				<div
					className="relative rounded-3xl overflow-hidden p-12 md:p-20 text-center"
					style={{
						background:
							'linear-gradient(135deg, var(--lf-cta-from) 0%, var(--lf-cta-mid) 50%, var(--lf-cta-from) 100%)',
						border: '1px solid var(--lf-cta-bd)',
					}}
				>
					<div className="lf-scan-beam" />
					<div
						className="absolute inset-0 pointer-events-none"
						style={{ background: 'radial-gradient(ellipse at 50% -10%, var(--lf-cta-glow) 0%, transparent 55%)' }}
					/>

					<div className="relative space-y-8">
						<div
							className="flex flex-wrap items-center justify-center gap-2 text-sm font-semibold"
							style={{ color: 'var(--lf-mu)' }}
						>
							{STAGES.map(({ key, label, icon: Icon }, i) => (
								<span key={key} className="inline-flex items-center gap-2">
									{i > 0 && <ArrowRight className="w-3.5 h-3.5" style={{ color: 'var(--lf-acc-bd-lg)' }} />}
									<span
										className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
										style={{
											backgroundColor: 'var(--lf-ghost)',
											color: 'var(--lf-tx)',
										}}
									>
										<Icon className="w-3.5 h-3.5" style={{ color: 'var(--lf-acc)' }} />
										{label}
									</span>
								</span>
							))}
						</div>

						<h2
							style={{
								fontFamily: "'Syne', sans-serif",
								fontWeight: 800,
								color: 'var(--lf-tx)',
								fontSize: 'clamp(28px,4vw,48px)',
								letterSpacing: '-0.025em',
								lineHeight: 1.1,
							}}
						>
							Start building your pipeline
							<br />
							<span className="lf-accent-text">today, for free</span>
						</h2>

						<p className="text-[18px] max-w-xl mx-auto" style={{ color: 'var(--lf-mu)' }}>
							Join teams using {environments.APP_NAME} to find high-fit prospects at scale and convert them with
							AI-personalised outreach.
						</p>

						<div className="flex flex-wrap items-center justify-center gap-4">
							<Link
								to={isLoggedIn ? Routes.dashboard.root : Routes.auth.sign_up}
								className="lf-btn-primary"
								style={{ paddingLeft: '32px', paddingRight: '32px', paddingTop: '16px', paddingBottom: '16px' }}
							>
								{isLoggedIn ? 'Go to Dashboard' : 'Get started free'}
								<ArrowRight className="w-4 h-4" />
							</Link>
							{!isLoggedIn && (
								<Link to={Routes.auth.sign_in} className="lf-btn-ghost lf-cta-ghost">
									Sign in
								</Link>
							)}
						</div>
					</div>
				</div>
			</Reveal>
		</section>
	);
}

/* ─── Footer ──────────────────────────────────────────────────────────────── */

function LandingFooter() {
	// Only link to destinations that exist. Pricing, About, Blog, Contact and the legal pages have no
	// route yet; add them here once those pages are ready.
	const cols: { heading: string; links: { label: string; to?: string; href?: string }[] }[] = [
		{
			heading: 'Product',
			links: [
				{ label: 'How it works', href: '#how-it-works' },
				{ label: 'Features', href: '#features' },
				{ label: 'Integrations', href: '#integrations' },
			],
		},
		{
			heading: 'Account',
			links: [
				{ label: 'Sign in', to: Routes.auth.sign_in },
				{ label: 'Get started free', to: Routes.auth.sign_up },
			],
		},
	];

	return (
		<footer className="border-t" style={{ borderColor: 'var(--lf-foot-bd)' }}>
			<div className="lf-wrap mx-auto px-6 py-16">
				<div className="flex flex-col md:flex-row items-start justify-between gap-10">
					<div className="space-y-4 max-w-xs">
						<Link to="/" className="flex items-center gap-2.5" style={{ textDecoration: 'none' }}>
							<AppLogo className="h-7 w-7" style={{ color: 'var(--lf-acc)' }} />
							<span
								style={{
									fontFamily: "'Syne', sans-serif",
									fontWeight: 700,
									fontSize: '17px',
									color: 'var(--lf-tx)',
								}}
							>
								{environments.APP_NAME}
							</span>
						</Link>
						<p className="text-sm leading-relaxed" style={{ color: 'var(--lf-mu)' }}>
							Find leads, score them with AI and reach out automatically.
						</p>
					</div>

					<div className="grid grid-cols-2 gap-16">
						{cols.map(({ heading, links }) => (
							<div key={heading} className="space-y-3">
								<p style={{ color: 'var(--lf-tx)', fontWeight: 600, fontSize: '14px' }}>{heading}</p>
								{links.map(({ label, to, href }) =>
									to ? (
										<Link key={label} to={to} className="lf-foot-link">
											{label}
										</Link>
									) : (
										<a key={label} href={href} className="lf-foot-link">
											{label}
										</a>
									),
								)}
							</div>
						))}
					</div>
				</div>

				<div
					className="mt-12 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4"
					style={{ borderColor: 'var(--lf-foot-bd)' }}
				>
					<p className="text-xs" style={{ color: 'var(--lf-mu)' }}>
						© {new Date().getFullYear()} {environments.APP_NAME}. All rights reserved.
					</p>
					<p className="text-xs" style={{ color: 'var(--lf-mu)' }}>
						Powered by{' '}
						<a
							href="https://logiqdev.com"
							target="_blank"
							rel="noopener noreferrer"
							className="transition-colors hover:underline"
							style={{ color: 'var(--lf-acc)' }}
						>
							Logiqdev
						</a>
					</p>
				</div>
			</div>
		</footer>
	);
}

/* ─── Shared primitives ───────────────────────────────────────────────────── */

function SectionLabel({ children, variant = 'blue' }: { children: ReactNode; variant?: Variant }) {
	return (
		<div className="flex justify-center mb-5">
			<span className={`lf-label lf-label-${variant}`}>{children}</span>
		</div>
	);
}

function SectionHeading({ children }: { children: ReactNode }) {
	return (
		<h2
			className="text-center"
			style={{
				fontFamily: "'Syne', system-ui, sans-serif",
				fontWeight: 700,
				fontSize: 'clamp(28px,4vw,44px)',
				color: 'var(--lf-tx)',
				letterSpacing: '-0.02em',
				lineHeight: 1.1,
			}}
		>
			{children}
		</h2>
	);
}
