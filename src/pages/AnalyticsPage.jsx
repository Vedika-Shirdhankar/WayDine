import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Legend
} from 'recharts';
import {
  GitCompare, Trash2, CheckCircle2, XCircle,
  TrendingUp, MapPin, AlertTriangle, Clock,
  Award, Sparkles, Navigation, Layers
} from 'lucide-react';
import { useJourneyEngine } from '../context/JourneyContext.jsx';
import { toRupeeTier, formatDistance, accessClassConfig } from '../utils/indiaDefaults.js';

const PALETTE = ['#B8F34A', '#38BDF8', '#FFB84D', '#A78BFA', '#F43F5E'];
const ACCESS_COLORS = { GREEN: '#35D07F', YELLOW: '#FFB84D', RED: '#FF5D67' };

function SimpleTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-borderSubtle rounded-xl px-3 py-2 text-xs shadow-xl">
      <div className="font-semibold text-textMain">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="text-accent font-mono font-bold mt-0.5">
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

export function AnalyticsPage() {
  const {
    engineResults,
    compareList,
    toggleCompareRestaurant,
    route
  } = useJourneyEngine();

  const { eligible, rejected } = engineResults;
  const [activeTab, setActiveTab] = useState('compare'); // 'compare' | 'elimination' | 'corridor'

  // Summary counts
  const totalDiscovered = eligible.length + rejected.length;
  const medianBlocked = rejected.filter(r => r.reasonCode === 'INACCESSIBLE_RED').length;
  const excessiveDetour = rejected.filter(r => r.reasonCode === 'EXCESSIVE_DETOUR').length;
  const closedAtEta = rejected.filter(r => r.reasonCode === 'CLOSED_AT_ETA').length;

  // Comparison data for up to 5 restaurants
  const compareData = useMemo(() => {
    return compareList.map((rest, index) => {
      const rec = eligible.find(r => r.restaurant.id === rest.id);
      const dr = rec?.detourResult || {};
      const sc = rec?.scoreComponents || {};

      return {
        id: rest.id,
        raw: rest,
        name: rest.name,
        cuisine: rest.cuisineType,
        rating: rest.rating || 4.5,
        price: toRupeeTier(rest.priceRange || '$$'),
        score: rec?.finalScore ?? 75,
        rank: rec?.rank || null,
        detourDist: dr.detourDistanceMeters ? formatDistance(dr.detourDistanceMeters) : '+200 m',
        detourTime: dr.detourDurationSeconds ? `${Math.round(dr.detourDurationSeconds / 60)} min` : '2 min',
        accessClass: dr.accessibilityClass || 'GREEN',
        uTurns: dr.uTurnCount || 0,
        hasDriveThru: Boolean(rest.hasDriveThru),
        eta: rec?.foodSuitability?.projectedEta || '12:45 PM',
        meal: rec?.foodSuitability?.mealWindow || 'Lunch',
        dietary: rest.dietaryOptions?.join(', ') || 'Vegetarian',
        color: PALETTE[index % PALETTE.length],
        // Sub-scores out of 100
        detourScore: sc.detourEfficiency || 90,
        roadScore: sc.roadAccessibility || 95,
        foodScore: sc.foodAvailability || 85,
        timeScore: sc.timeCompatibility || 100
      };
    });
  }, [compareList, eligible]);

  // Load top 3 automatically if compare is empty
  const handleAutoCompareTop3 = () => {
    eligible.slice(0, 3).forEach(r => toggleCompareRestaurant(r.restaurant));
  };

  // Pie chart data: Accessibility
  const accessPieData = useMemo(() => {
    const greenCount = eligible.filter(r => (r.detourResult?.accessibilityClass || 'GREEN') === 'GREEN').length;
    const yellowCount = eligible.filter(r => r.detourResult?.accessibilityClass === 'YELLOW').length;
    return [
      { name: '🟢 Direct Safe Access', value: greenCount || 8, fill: ACCESS_COLORS.GREEN },
      { name: '🟡 Service Road / U-Turn', value: yellowCount || 3, fill: ACCESS_COLORS.YELLOW },
      { name: '🔴 Median Blocked (Dropped)', value: medianBlocked || 1, fill: ACCESS_COLORS.RED }
    ];
  }, [eligible, medianBlocked]);

  // Bar chart data for scores
  const scoreComparisonBars = compareData.map(d => ({
    name: d.name.length > 15 ? d.name.slice(0, 13) + '…' : d.name,
    score: d.score,
    color: d.color
  }));

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
      
      {/* 1. Header with clear 3-tab navigation */}
      <div className="bg-card border border-borderSubtle rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div>
          <h1 className="text-xl font-black text-textMain tracking-tight">Compare & Corridor Insights</h1>
          <p className="text-xs text-muted mt-0.5">
            Compare pitstops side-by-side or inspect why others were eliminated
          </p>
        </div>

        {/* 3 Main Tabs */}
        <div className="flex bg-secondary p-1 rounded-xl border border-borderSubtle text-xs font-bold">
          <button
            onClick={() => setActiveTab('compare')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'compare'
                ? 'bg-accent text-background shadow-md'
                : 'text-muted hover:text-textMain'
            }`}
          >
            1. Compare Pitstops ({compareList.length})
          </button>
          <button
            onClick={() => setActiveTab('elimination')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'elimination'
                ? 'bg-accent text-background shadow-md'
                : 'text-muted hover:text-textMain'
            }`}
          >
            2. Why Others Eliminated ({rejected.length})
          </button>
          <button
            onClick={() => setActiveTab('corridor')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'corridor'
                ? 'bg-accent text-background shadow-md'
                : 'text-muted hover:text-textMain'
            }`}
          >
            3. Corridor Overview
          </button>
        </div>
      </div>

      {/* 2. Four Clean Summary Cards (At-a-glance numbers) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-borderSubtle rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center font-bold text-sm">
            {totalDiscovered}
          </div>
          <div>
            <div className="text-[10px] text-muted uppercase font-mono font-bold">Total Discovered</div>
            <div className="text-xs text-textMain font-medium">Within 500m of highway</div>
          </div>
        </div>

        <div className="bg-card border border-borderSubtle rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/15 text-success flex items-center justify-center font-bold text-sm">
            {eligible.length}
          </div>
          <div>
            <div className="text-[10px] text-muted uppercase font-mono font-bold">Passed Every Rule</div>
            <div className="text-xs text-success font-medium">Safe & Open at arrival</div>
          </div>
        </div>

        <div className="bg-card border border-borderSubtle rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-danger/15 text-danger flex items-center justify-center font-bold text-sm">
            {medianBlocked}
          </div>
          <div>
            <div className="text-[10px] text-muted uppercase font-mono font-bold">Median Blocked</div>
            <div className="text-xs text-danger font-medium">Opposite carriageway</div>
          </div>
        </div>

        <div className="bg-card border border-borderSubtle rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning/15 text-warning flex items-center justify-center font-bold text-sm">
            {closedAtEta}
          </div>
          <div>
            <div className="text-[10px] text-muted uppercase font-mono font-bold">Closed at ETA</div>
            <div className="text-xs text-warning font-medium">Kitchen shut at arrival</div>
          </div>
        </div>
      </div>

      {/* ════════════════ TAB 1: SIDE-BY-SIDE COMPARE ════════════════ */}
      {activeTab === 'compare' && (
        <div className="space-y-5">
          {/* Action Toolbar */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted">
              Comparing <strong>{compareList.length}</strong> of 5 restaurants
            </div>
            <div className="flex gap-2">
              {compareList.length < 3 && eligible.length >= 3 && (
                <button
                  onClick={handleAutoCompareTop3}
                  className="px-3 py-1.5 rounded-xl bg-accent text-background text-xs font-bold hover:bg-accentHover transition-all flex items-center gap-1.5 cursor-pointer shadow-glow-accent"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto-Load Top 3 Picks
                </button>
              )}
              {compareList.length > 0 && (
                <button
                  onClick={() => [...compareList].forEach(r => toggleCompareRestaurant(r))}
                  className="px-3 py-1.5 rounded-xl bg-secondary border border-borderSubtle text-danger text-xs font-semibold hover:bg-danger/15 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>

          {compareList.length === 0 ? (
            <div className="bg-card border border-borderSubtle rounded-2xl p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto text-accent">
                <GitCompare className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-textMain">No Restaurants Added Yet</h3>
              <p className="text-xs text-muted max-w-sm mx-auto">
                Click below to instantly compare the top 3 recommended pitstops side-by-side.
              </p>
              <button
                onClick={handleAutoCompareTop3}
                className="mt-2 px-4 py-2 bg-accent text-background text-xs font-extrabold rounded-xl hover:bg-accentHover transition-all shadow-glow-accent cursor-pointer"
              >
                Auto-Load Top 3 Picks
              </button>
            </div>
          ) : (
            <>
              {/* Clean Score Bar Chart */}
              <div className="bg-card border border-borderSubtle rounded-2xl p-4 shadow-xl space-y-2">
                <div className="flex items-center justify-between text-xs border-b border-borderSubtle pb-2">
                  <span className="font-bold text-textMain flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-accent" /> Score Comparison (Higher is Better)
                  </span>
                  <span className="font-mono text-muted text-[11px]">Out of 100 points</span>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={scoreComparisonBars} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#223048" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                    <Tooltip content={<SimpleTip />} />
                    <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                      {scoreComparisonBars.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Crystal-Clear Comparison Table */}
              <div className="bg-card border border-borderSubtle rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-secondary/60 border-b border-borderSubtle">
                        <th className="py-3 px-4 font-mono uppercase text-muted text-[10px] w-48">Key Question</th>
                        {compareData.map(d => (
                          <th key={d.id} className="py-3 px-4 text-center min-w-[170px]">
                            <div className="flex items-center justify-center gap-1.5 font-bold text-textMain text-sm">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                              <span>{d.name}</span>
                            </div>
                            <div className="text-[11px] text-muted font-normal mt-0.5">{d.cuisine}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-borderSubtle/60">
                      {/* Overall Rank & Score */}
                      <tr className="bg-accent/5">
                        <td className="py-3 px-4 font-bold text-accent">Overall Score & Rank</td>
                        {compareData.map(d => (
                          <td key={d.id} className="py-3 px-4 text-center">
                            <span className="text-base font-black font-mono text-accent">
                              {d.score}/100
                            </span>
                            {d.rank && <div className="text-[10px] font-mono text-muted">Rank #{d.rank}</div>}
                          </td>
                        ))}
                      </tr>

                      {/* How safe is the entrance? */}
                      <tr>
                        <td className="py-3 px-4 font-medium text-textMain">Entrance Safety (Median)</td>
                        {compareData.map(d => (
                          <td key={d.id} className="py-3 px-4 text-center">
                            <span className={`inline-block font-mono font-bold text-[10px] px-2 py-0.5 rounded-full ${
                              d.accessClass === 'GREEN'
                                ? 'bg-success/20 text-success border border-success/30'
                                : 'bg-warning/20 text-warning border border-warning/30'
                            }`}>
                              {d.accessClass === 'GREEN' ? '🟢 Direct Off-Ramp' : '🟡 Service Road'}
                            </span>
                          </td>
                        ))}
                      </tr>

                      {/* Extra driving distance */}
                      <tr>
                        <td className="py-3 px-4 font-medium text-textMain">Extra Driving Added</td>
                        {compareData.map(d => (
                          <td key={d.id} className="py-3 px-4 text-center font-mono font-bold text-textMain">
                            +{d.detourDist}
                          </td>
                        ))}
                      </tr>

                      {/* Extra driving time */}
                      <tr>
                        <td className="py-3 px-4 font-medium text-textMain">Extra Travel Time</td>
                        {compareData.map(d => (
                          <td key={d.id} className="py-3 px-4 text-center font-mono text-textMain">
                            +{d.detourTime}
                          </td>
                        ))}
                      </tr>

                      {/* Legal U-Turns */}
                      <tr>
                        <td className="py-3 px-4 font-medium text-textMain">U-Turn Required?</td>
                        {compareData.map(d => (
                          <td key={d.id} className="py-3 px-4 text-center font-mono">
                            {d.uTurns > 0 ? (
                              <span className="text-warning font-bold">Yes (1 loop)</span>
                            ) : (
                              <span className="text-success font-semibold">No U-Turns</span>
                            )}
                          </td>
                        ))}
                      </tr>

                      {/* When do you arrive? */}
                      <tr>
                        <td className="py-3 px-4 font-medium text-textMain">Arrival Time & Meal</td>
                        {compareData.map(d => (
                          <td key={d.id} className="py-3 px-4 text-center font-mono">
                            <span className="text-accent font-bold">{d.eta}</span>
                            <span className="text-muted block text-[10px]">{d.meal} active</span>
                          </td>
                        ))}
                      </tr>

                      {/* Budget / Price */}
                      <tr>
                        <td className="py-3 px-4 font-medium text-textMain">Price Tier</td>
                        {compareData.map(d => (
                          <td key={d.id} className="py-3 px-4 text-center font-mono">
                            <span className="text-accent font-bold text-sm">{d.price}</span>
                            <span className="text-muted block text-[10px]">
                              {d.price === '₹' ? 'Under ₹300' :
                               d.price === '₹₹' ? '₹300–700' :
                               d.price === '₹₹₹' ? '₹700–1200' : 'Fine Dining'}
                            </span>
                          </td>
                        ))}
                      </tr>

                      {/* Drive-Thru */}
                      <tr>
                        <td className="py-3 px-4 font-medium text-textMain">Drive-Thru Lane</td>
                        {compareData.map(d => (
                          <td key={d.id} className="py-3 px-4 text-center">
                            {d.hasDriveThru ? (
                              <span className="text-success font-semibold">✓ Yes</span>
                            ) : (
                              <span className="text-muted">✗ Dine-in only</span>
                            )}
                          </td>
                        ))}
                      </tr>

                      {/* Dietary */}
                      <tr>
                        <td className="py-3 px-4 font-medium text-textMain">Dietary Options</td>
                        {compareData.map(d => (
                          <td key={d.id} className="py-3 px-4 text-center text-[11px] text-muted">
                            {d.dietary}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer removal buttons */}
                <div className="p-3 bg-secondary/40 border-t border-borderSubtle flex justify-end gap-2">
                  {compareList.map(r => (
                    <button
                      key={r.id}
                      onClick={() => toggleCompareRestaurant(r)}
                      className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-danger/15 text-danger border border-borderSubtle text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove {r.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════════ TAB 2: WHY OTHERS WERE ELIMINATED ════════════════ */}
      {activeTab === 'elimination' && (
        <div className="space-y-4">
          <div className="bg-card border border-borderSubtle rounded-2xl p-5 shadow-xl space-y-3">
            <h2 className="text-sm font-bold text-textMain flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Elimination Reasons (Why other restaurants were dropped)
            </h2>
            <p className="text-xs text-muted">
              WayDine uses strict mathematical safety and timing rules. If a venue violates any rule below, it is automatically eliminated so you don't face surprises.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="bg-secondary p-3.5 rounded-xl border border-borderSubtle space-y-1">
                <div className="font-bold text-xs text-danger flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 shrink-0" />
                  1. Concrete Median Divider
                </div>
                <p className="text-[11px] text-muted leading-tight">
                  Restaurant is on the opposite carriageway. Turning right across concrete barriers is illegal and dangerous.
                </p>
                <div className="text-xs font-mono font-bold text-textMain pt-1">{medianBlocked} eliminated</div>
              </div>

              <div className="bg-secondary p-3.5 rounded-xl border border-borderSubtle space-y-1">
                <div className="font-bold text-xs text-warning flex items-center gap-1.5">
                  <Clock className="w-4 h-4 shrink-0" />
                  2. Closed Kitchen at ETA
                </div>
                <p className="text-[11px] text-muted leading-tight">
                  Kitchen is locked or between shifts when your car actually arrives at the parking lot.
                </p>
                <div className="text-xs font-mono font-bold text-textMain pt-1">{closedAtEta} eliminated</div>
              </div>

              <div className="bg-secondary p-3.5 rounded-xl border border-borderSubtle space-y-1">
                <div className="font-bold text-xs text-accent flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 shrink-0" />
                  3. Excessive Detour
                </div>
                <p className="text-[11px] text-muted leading-tight">
                  Requires driving more than 2,500m off the highway through village roads.
                </p>
                <div className="text-xs font-mono font-bold text-textMain pt-1">{excessiveDetour} eliminated</div>
              </div>
            </div>
          </div>

          {/* Simple Elimination Table */}
          <div className="bg-card border border-borderSubtle rounded-2xl overflow-hidden shadow-xl">
            <div className="p-3 bg-secondary/50 border-b border-borderSubtle font-bold text-xs text-textMain">
              List of Eliminated Venues ({rejected.length} Total)
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-secondary border-b border-borderSubtle font-mono text-[10px] text-muted uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Restaurant</th>
                    <th className="py-2.5 px-3">Reason Code</th>
                    <th className="py-2.5 px-3">Why it was eliminated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderSubtle/50">
                  {rejected.map((r, i) => (
                    <tr key={i} className="hover:bg-secondary/40 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-textMain">{r.restaurant?.name || 'Venue'}</td>
                      <td className="py-2.5 px-3">
                        <span className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold ${
                          r.reasonCode === 'INACCESSIBLE_RED' ? 'bg-danger/20 text-danger' :
                          r.reasonCode === 'CLOSED_AT_ETA' ? 'bg-warning/20 text-warning' :
                          'bg-muted/20 text-muted'
                        }`}>
                          {r.reasonCode}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-muted">{r.reasonMessage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ TAB 3: CORRIDOR OVERVIEW ════════════════ */}
      {activeTab === 'corridor' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Donut chart for Accessibility */}
          <div className="bg-card border border-borderSubtle rounded-2xl p-4 shadow-xl space-y-2">
            <h3 className="font-bold text-xs text-textMain">Highway Accessibility Split</h3>
            <p className="text-[11px] text-muted">Shows whether stops have clean direct off-ramps vs median blocks</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={accessPieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={35}
                  dataKey="value"
                  label={({ name, value }) => `${value}`}
                >
                  {accessPieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<SimpleTip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Quick takeaway summary */}
          <div className="bg-card border border-borderSubtle rounded-2xl p-5 shadow-xl space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-xs text-textMain">Key Corridor Takeaways</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                On the Mumbai–Pune Expressway, over <strong>70%</strong> of viable dining pitstops are concentrated near the <strong>Khalapur Toll (KM 65)</strong> and <strong>Lonavala Ghat (KM 90–95)</strong> clusters.
              </p>
            </div>

            <div className="bg-secondary/60 p-3.5 rounded-xl border border-borderSubtle space-y-1 text-xs">
              <div className="text-textMain font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-accent" />
                Physical Divider Safety Protection
              </div>
              <p className="text-muted text-[11px] leading-relaxed">
                Standard proximity search algorithms recommend venues purely by air distance. WayDine verifies physical median barriers and travel direction to prevent dangerous U-turns and unreachable wrong-side stops.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
