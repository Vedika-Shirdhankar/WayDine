import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Compass,
  MapPin,
  Clock,
  Zap,
  CornerDownRight,
  ChevronRight,
  ArrowDown,
  Navigation,
} from 'lucide-react';

/* ─────────────────────────────────────────
   Animated SVG Route Illustration
───────────────────────────────────────── */
function RouteIllustration() {
  return (
    <div className="flex justify-center w-full my-8">
      <svg
        viewBox="0 0 600 220"
        width="100%"
        style={{ maxWidth: 600 }}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Route illustration from Mumbai to Pune"
      >
        {/* Background */}
        <rect width="600" height="220" fill="#080D18" rx="16" />

        {/* Road/route corridor */}
        <path
          id="routePath"
          d="M 40,180 C 100,160 150,80 240,70 S 380,100 460,60 S 540,40 570,30"
          fill="none"
          stroke="#223048"
          strokeWidth="18"
          strokeLinecap="round"
        />

        {/* Animated route line (lime accent) */}
        <path
          d="M 40,180 C 100,160 150,80 240,70 S 380,100 460,60 S 540,40 570,30"
          fill="none"
          stroke="#B8F34A"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="700"
          strokeDashoffset="700"
          style={{
            animation: 'drawRoute 2.2s ease forwards',
          }}
        />

        {/* Restaurant markers */}
        {/* Green - direct access */}
        <circle cx="150" cy="110" r="8" fill="#35D07F" opacity="0.9">
          <animate attributeName="r" values="8;10;8" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="150" cy="110" r="4" fill="#35D07F" />

        {/* Yellow - u-turn required */}
        <circle cx="260" cy="78" r="8" fill="#FFB84D" opacity="0.9">
          <animate attributeName="r" values="8;10;8" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle cx="260" cy="78" r="4" fill="#FFB84D" />

        {/* Red - opposite carriageway */}
        <circle cx="370" cy="88" r="8" fill="#FF5D67" opacity="0.9">
          <animate attributeName="r" values="8;10;8" dur="2.8s" repeatCount="indefinite" />
        </circle>
        <circle cx="370" cy="88" r="4" fill="#FF5D67" />

        {/* Green - direct access */}
        <circle cx="460" cy="62" r="8" fill="#35D07F" opacity="0.9">
          <animate attributeName="r" values="8;10;8" dur="1.8s" repeatCount="indefinite" />
        </circle>
        <circle cx="460" cy="62" r="4" fill="#35D07F" />

        {/* Grey - closed */}
        <circle cx="530" cy="40" r="8" fill="#94A3B8" opacity="0.9" />
        <circle cx="530" cy="40" r="4" fill="#94A3B8" />

        {/* Animated vehicle dot */}
        <circle r="7" fill="#B8F34A" filter="url(#glow)">
          <animateMotion dur="4s" repeatCount="indefinite" rotate="auto">
            <mpath href="#routePath" />
          </animateMotion>
        </circle>
        <circle r="4" fill="#080D18">
          <animateMotion dur="4s" repeatCount="indefinite" rotate="auto">
            <mpath href="#routePath" />
          </animateMotion>
        </circle>

        {/* Glow filter */}
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* City labels */}
        <text x="30" y="200" fill="#94A3B8" fontSize="11" fontFamily="sans-serif">Mumbai</text>
        <text x="548" y="25" fill="#94A3B8" fontSize="11" fontFamily="sans-serif">Pune</text>

        {/* Legend */}
        <circle cx="30" cy="28" r="5" fill="#35D07F" />
        <text x="40" y="32" fill="#94A3B8" fontSize="10" fontFamily="sans-serif">Direct</text>
        <circle cx="90" cy="28" r="5" fill="#FFB84D" />
        <text x="100" y="32" fill="#94A3B8" fontSize="10" fontFamily="sans-serif">U-Turn</text>
        <circle cx="155" cy="28" r="5" fill="#FF5D67" />
        <text x="165" y="32" fill="#94A3B8" fontSize="10" fontFamily="sans-serif">Opposite</text>

        <style>{`
          @keyframes drawRoute {
            to { stroke-dashoffset: 0; }
          }
        `}</style>
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────
   Feature Card
───────────────────────────────────────── */
function FeatureCard({ icon: Icon, title, description }) {
  return (
    <div className="bg-card border border-borderSubtle rounded-2xl p-6 flex flex-col gap-3 hover:bg-cardHover hover:border-borderStrong hover:scale-105 transition-all duration-300 cursor-default">
      <div className="w-11 h-11 rounded-xl bg-background border border-borderSubtle flex items-center justify-center">
        <Icon className="w-5 h-5 text-accent" />
      </div>
      <h3 className="text-textMain font-semibold text-base leading-snug">{title}</h3>
      <p className="text-muted text-sm leading-relaxed">{description}</p>
    </div>
  );
}

/* ─────────────────────────────────────────
   Step Card
───────────────────────────────────────── */
function StepCard({ number, title, description }) {
  return (
    <div className="bg-card border border-borderSubtle rounded-2xl p-6 flex flex-col gap-3 hover:border-borderStrong transition-all duration-300">
      <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
        <span className="text-background font-bold text-sm">{number}</span>
      </div>
      <h3 className="text-textMain font-semibold text-base">{title}</h3>
      <p className="text-muted text-sm leading-relaxed">{description}</p>
    </div>
  );
}

/* ─────────────────────────────────────────
   Tech Pill
───────────────────────────────────────── */
function TechPill({ label }) {
  return (
    <span className="px-3 py-1.5 rounded-full bg-secondary border border-borderSubtle text-muted text-xs font-medium hover:border-accent hover:text-accent transition-colors duration-200">
      {label}
    </span>
  );
}

/* ─────────────────────────────────────────
   Main Landing Page
───────────────────────────────────────── */
export function LandingPage() {
  const featuresRef = useRef(null);

  const scrollToFeatures = (e) => {
    e.preventDefault();
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background text-textMain overflow-x-hidden">
      {/* ── Dot-grid background overlay ── */}
      <style>{`
        .dot-bg {
          background-image: radial-gradient(circle, #223048 1px, transparent 1px);
          background-size: 28px 28px;
        }
        .hero-glow {
          background: radial-gradient(ellipse 70% 55% at 50% 40%, rgba(184,243,74,0.08) 0%, transparent 70%);
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.7s ease both; }
        .fade-up-1 { animation-delay: 0.1s; }
        .fade-up-2 { animation-delay: 0.25s; }
        .fade-up-3 { animation-delay: 0.4s; }
        .fade-up-4 { animation-delay: 0.55s; }
        .fade-up-5 { animation-delay: 0.7s; }
        .fade-up-6 { animation-delay: 0.85s; }
      `}</style>

      {/* ════════════════════════════════
          HERO SECTION
      ════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center dot-bg px-4">
        {/* Glow overlay */}
        <div className="absolute inset-0 hero-glow pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-3xl mx-auto gap-6">

          {/* Logo */}
          <div className="fade-up fade-up-1 flex items-center gap-2.5 mb-2">
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center">
              <Compass className="w-5 h-5 text-accent" />
            </div>
            <span className="text-2xl font-bold tracking-tight">
              Way<span className="text-accent">Dine</span>
            </span>
          </div>

          {/* Heading */}
          <h1 className="fade-up fade-up-2 text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
            Every Journey Deserves a{' '}
            <span className="text-accent">Smarter Stop.</span>
          </h1>

          {/* Subtitle */}
          <p className="fade-up fade-up-3 text-muted text-base sm:text-lg md:text-xl leading-relaxed max-w-2xl">
            Discover restaurants that fit your route, match your direction, and meet you at the right
            time. No unnecessary detours. No wrong-side stops.
          </p>

          {/* Tagline */}
          <p className="fade-up fade-up-4 text-sm text-muted/70 italic">
            Your Journey. Your Direction. Your Perfect Pitstop.
          </p>

          {/* CTAs */}
          <div className="fade-up fade-up-5 flex flex-col sm:flex-row gap-4 mt-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-accent text-background font-semibold text-sm hover:bg-accent/90 hover:scale-105 active:scale-95 transition-all duration-200 shadow-glow-accent"
            >
              Plan Your Journey
              <ChevronRight className="w-4 h-4" />
            </Link>
            <a
              href="#features"
              onClick={scrollToFeatures}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl border border-borderStrong text-textMain font-semibold text-sm hover:border-accent hover:text-accent hover:scale-105 active:scale-95 transition-all duration-200"
            >
              Explore Features
              <ArrowDown className="w-4 h-4" />
            </a>
          </div>

          {/* Route Illustration */}
          <div className="fade-up fade-up-6 w-full mt-4">
            <RouteIllustration />
            <p className="text-xs text-muted/60 mt-1">
              Green = direct access · Yellow = U-turn route · Red = opposite carriageway · Grey = closed
            </p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
          FEATURE CARDS
      ════════════════════════════════ */}
      <section id="features" className="py-20 px-4 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-accent text-xs font-semibold uppercase tracking-widest">Features</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-textMain">Built Different.</h2>
          <p className="mt-3 text-muted text-sm sm:text-base max-w-xl mx-auto">
            No AI. No black box. Pure deterministic logic built on real road geometry.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <FeatureCard
            icon={MapPin}
            title="Route-Aware Recommendations"
            description="Restaurants scored by real road-network distance, not straight-line proximity. Only ahead-of-vehicle stops qualify."
          />
          <FeatureCard
            icon={CornerDownRight}
            title="Zero Unnecessary U-Turns"
            description="Dijkstra on a local road graph with U-turn and turn penalties. Every detour is real road distance, not guesswork."
          />
          <FeatureCard
            icon={Clock}
            title="ETA-Based Food Suggestions"
            description="Each restaurant's ETA is individually computed. Opening hours and food-category windows are checked at that exact arrival time."
          />
          <FeatureCard
            icon={Zap}
            title="Minimum Detour Optimization"
            description="Corridor filter → direction filter → accessibility class → deterministic weighted score. No AI. No surprises."
          />
        </div>
      </section>

      {/* ════════════════════════════════
          HOW IT WORKS
      ════════════════════════════════ */}
      <section className="py-20 px-4 bg-secondary border-y border-borderSubtle">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-accent text-xs font-semibold uppercase tracking-widest">Under the Hood</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-textMain">How It Works</h2>
            <p className="mt-3 text-muted text-sm sm:text-base max-w-xl mx-auto">
              Four deterministic steps. Zero guesswork.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StepCard
              number="1"
              title="Get the Route"
              description="OSRM public API supplies the route geometry (lat/lng polyline, distance, duration). No API key required. Falls back to a bundled demo route if OSRM is unavailable."
            />
            <StepCard
              number="2"
              title="Filter the Corridor"
              description="Every restaurant within 200 m of the route polyline is a candidate. Only restaurants ahead of the vehicle (by cross-product bearing) proceed."
            />
            <StepCard
              number="3"
              title="Validate & Score Detour"
              description="Dijkstra on a hand-built local road graph computes the real extra distance and turn count. Restaurants on the opposite carriageway are marked RED. U-turn routes are YELLOW. Direct access is GREEN."
            />
            <StepCard
              number="4"
              title="Match ETA to Food"
              description="Each restaurant gets its own ETA (vehicle speed × remaining route distance). Opening hours and food-category windows are checked at that exact time. The final score is a deterministic weighted sum: detour (30%) + direction (25%) + accessibility (20%) + food at ETA (15%) + time compatibility (10%)."
            />
          </div>

          {/* Note */}
          <div className="mt-10 text-center">
            <p className="text-muted text-sm max-w-2xl mx-auto">
              <span className="text-textMain font-semibold">No AI or machine learning is used.</span>{' '}
              OSRM supplies the geometry. Dijkstra supplies the detour and U-turn logic. The score is a
              deterministic formula.
            </p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
          TECH STACK
      ════════════════════════════════ */}
      <section className="py-16 px-4 max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <span className="text-accent text-xs font-semibold uppercase tracking-widest">Stack</span>
          <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-textMain">Built With</h2>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {[
            'React 18',
            'Vite 5',
            'Tailwind CSS',
            'React-Leaflet / OSM',
            'OSRM (Public)',
            'Recharts',
            'Dijkstra (custom)',
            'Haversine (custom)',
            'Vitest (50 tests)',
          ].map((tech) => (
            <TechPill key={tech} label={tech} />
          ))}
        </div>
      </section>

      {/* ════════════════════════════════
          DATA DISCLAIMER
      ════════════════════════════════ */}
      <section className="px-4 pb-16 max-w-4xl mx-auto">
        <div className="bg-warning/10 border border-warning/30 rounded-2xl p-6 flex gap-4 items-start">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center mt-0.5">
            <span className="text-warning text-sm font-bold">!</span>
          </div>
          <div>
            <h3 className="text-warning font-semibold text-sm mb-1">Demo Data Disclaimer</h3>
            <p className="text-muted text-sm leading-relaxed">
              Demo restaurants are sample data, not live listings. Route geometry is approximated. OSRM
              is the public API — rate limits apply.
            </p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
          FOOTER
      ════════════════════════════════ */}
      <footer className="border-t border-borderSubtle bg-secondary py-12 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center sm:items-start justify-between gap-8">

          {/* Logo + tagline */}
          <div className="flex flex-col items-center sm:items-start gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
                <Compass className="w-4 h-4 text-accent" />
              </div>
              <span className="font-bold text-lg">
                Way<span className="text-accent">Dine</span>
              </span>
            </div>
            <p className="text-muted text-xs">Your Journey. Your Direction. Your Perfect Pitstop.</p>
          </div>

          {/* Nav links */}
          <nav className="flex flex-wrap justify-center sm:justify-end gap-x-6 gap-y-2">
            {[
              { label: 'Dashboard', to: '/dashboard' },
              { label: 'Pitstops', to: '/pitstops' },
              { label: 'Simulator', to: '/simulator' },
              { label: 'Analytics', to: '/analytics' },
            ].map(({ label, to }) => (
              <Link
                key={to}
                to={to}
                className="text-muted text-sm hover:text-accent transition-colors duration-200"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom text */}
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-borderSubtle text-center">
          <p className="text-muted/60 text-xs">
            Built for hackathon demo. © 2026 WayDine. Sample data only.
          </p>
        </div>
      </footer>
    </div>
  );
}
