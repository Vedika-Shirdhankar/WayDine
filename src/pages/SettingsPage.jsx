import { useState, useEffect } from 'react';
import {
  Settings,
  Sliders,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Info,
  Shield,
} from 'lucide-react';
import { useJourneyEngine } from '../context/JourneyContext.jsx';

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS = {
  detourEfficiency: 30,
  directionCompatibility: 25,
  roadAccessibility: 20,
  foodAvailability: 15,
  timeCompatibility: 10,
};

const DEFAULT_ENGINE_CONFIG = {
  corridorMeters: 200,
  maxDetourMeters: 2500,
  uTurnPenalty: 500,
  turnPenalty: 100,
  stopDurationMin: 30,
  drivingSide: 'left',
  aheadOnly: true,
  behindToleranceMeters: 500,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadWeights() {
  try {
    const raw = localStorage.getItem('waydine_weights');
    if (raw) return { ...DEFAULT_WEIGHTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_WEIGHTS };
}

function loadEngineConfig() {
  try {
    const raw = localStorage.getItem('waydine_engine_config');
    if (raw) return { ...DEFAULT_ENGINE_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_ENGINE_CONFIG };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-card border border-borderSubtle rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} className="text-muted" />}
        <span className="text-xs font-mono uppercase tracking-widest text-muted">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function RangeSlider({ label, value, min, max, step, unit = '', onChange, disabled = false }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm text-textMain">{label}</span>
        <span className="text-sm font-mono text-accent">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-1.5 rounded-full appearance-none cursor-pointer accent-accent ${
          disabled ? 'opacity-40 cursor-not-allowed' : ''
        }`}
        style={{ background: `linear-gradient(to right, #B8F34A ${((value - min) / (max - min)) * 100}%, #223048 0%)` }}
      />
      <div className="flex justify-between text-xs text-muted">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

function SaveFlash({ show }) {
  if (!show) return null;
  return (
    <span className="flex items-center gap-1 text-success text-sm animate-pulse">
      <CheckCircle2 size={14} />
      Saved!
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { updateFilters } = useJourneyEngine();

  // Section 1: Weights
  const [weights, setWeights] = useState(loadWeights);
  const [weightsSaved, setWeightsSaved] = useState(false);

  // Section 2 & 3: Engine + Corridor
  const [engineConfig, setEngineConfig] = useState(loadEngineConfig);
  const [engineSaved, setEngineSaved] = useState(false);

  const weightsTotal = Object.values(weights).reduce((s, v) => s + v, 0);
  const weightsValid = weightsTotal === 100;

  // ── Weight handlers ──────────────────────────────────────────────────────
  function handleWeightChange(key, value) {
    setWeights((prev) => ({ ...prev, [key]: value }));
  }

  function handleApplyWeights() {
    if (!weightsValid) return;
    localStorage.setItem('waydine_weights', JSON.stringify(weights));
    updateFilters({});
    flashSaved(setWeightsSaved);
  }

  function handleResetWeights() {
    setWeights({ ...DEFAULT_WEIGHTS });
  }

  // ── Engine config handlers ───────────────────────────────────────────────
  function handleEngineChange(key, value) {
    setEngineConfig((prev) => ({ ...prev, [key]: value }));
  }

  function handleApplyEngine() {
    localStorage.setItem('waydine_engine_config', JSON.stringify(engineConfig));
    updateFilters({
      maxDetourMeters: engineConfig.maxDetourMeters,
    });
    flashSaved(setEngineSaved);
  }

  function handleResetEngine() {
    setEngineConfig({ ...DEFAULT_ENGINE_CONFIG });
  }

  // ── Reset All ────────────────────────────────────────────────────────────
  function handleResetAll() {
    setWeights({ ...DEFAULT_WEIGHTS });
    setEngineConfig({ ...DEFAULT_ENGINE_CONFIG });
    localStorage.setItem('waydine_weights', JSON.stringify(DEFAULT_WEIGHTS));
    localStorage.setItem('waydine_engine_config', JSON.stringify(DEFAULT_ENGINE_CONFIG));
    updateFilters({ maxDetourMeters: DEFAULT_ENGINE_CONFIG.maxDetourMeters });
    flashSaved(setWeightsSaved);
    flashSaved(setEngineSaved);
  }

  function flashSaved(setter) {
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  // ── Supabase check ───────────────────────────────────────────────────────
  const supabaseConfigured =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    !!import.meta.env.VITE_SUPABASE_URL;

  // ── Weight labels ────────────────────────────────────────────────────────
  const weightFields = [
    { key: 'detourEfficiency', label: 'Detour Efficiency' },
    { key: 'directionCompatibility', label: 'Direction Compatibility' },
    { key: 'roadAccessibility', label: 'Road Accessibility' },
    { key: 'foodAvailability', label: 'Food Availability at ETA' },
    { key: 'timeCompatibility', label: 'Time Compatibility' },
  ];

  return (
    <div className="min-h-screen bg-background text-textMain">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* ── Page Header ─────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-secondary rounded-xl border border-borderSubtle">
            <Settings size={22} className="text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-textMain">Engine Settings</h1>
            <p className="text-sm text-muted mt-0.5">
              Tune the recommendation engine scoring and corridor parameters
            </p>
          </div>
        </div>

        {/* ── Section 1: Scoring Weights ──────────────────────────────── */}
        <SectionCard title="Scoring Weights" icon={Sliders}>
          <div className="space-y-5">
            {weightFields.map(({ key, label }) => (
              <RangeSlider
                key={key}
                label={label}
                value={weights[key]}
                min={0}
                max={60}
                step={5}
                onChange={(v) => handleWeightChange(key, v)}
              />
            ))}
          </div>

          {/* Total indicator */}
          <div
            className={`flex items-center gap-2 mt-2 text-sm font-mono ${
              weightsValid ? 'text-success' : 'text-danger'
            }`}
          >
            {weightsValid ? (
              <CheckCircle2 size={14} />
            ) : (
              <AlertCircle size={14} />
            )}
            Total: {weightsTotal} / 100
            {!weightsValid && (
              <span className="text-xs text-danger ml-1">
                — must sum to exactly 100
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <div className="relative group">
              <button
                onClick={handleApplyWeights}
                disabled={!weightsValid}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  weightsValid
                    ? 'bg-accent text-background hover:bg-lime-400'
                    : 'bg-borderSubtle text-muted cursor-not-allowed'
                }`}
              >
                Apply Weights
              </button>
              {!weightsValid && (
                <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-secondary border border-borderSubtle rounded-lg text-xs text-muted whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Weights must sum to 100
                </div>
              )}
            </div>
            <button
              onClick={handleResetWeights}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-muted hover:text-textMain border border-borderSubtle hover:border-borderStrong transition-colors"
            >
              <RotateCcw size={13} />
              Reset to Defaults
            </button>
            <SaveFlash show={weightsSaved} />
          </div>
        </SectionCard>

        {/* ── Section 2: Engine Configuration ────────────────────────── */}
        <SectionCard title="Engine Configuration" icon={Settings}>
          <div className="space-y-5">
            <RangeSlider
              label="Corridor Width (m)"
              value={engineConfig.corridorMeters}
              min={50}
              max={500}
              step={50}
              unit=" m"
              onChange={(v) => handleEngineChange('corridorMeters', v)}
            />
            <RangeSlider
              label="Max Detour (m)"
              value={engineConfig.maxDetourMeters}
              min={500}
              max={5000}
              step={250}
              unit=" m"
              onChange={(v) => handleEngineChange('maxDetourMeters', v)}
            />
            <RangeSlider
              label="U-Turn Penalty (m-equiv)"
              value={engineConfig.uTurnPenalty}
              min={100}
              max={2000}
              step={100}
              unit=" m"
              onChange={(v) => handleEngineChange('uTurnPenalty', v)}
            />
            <RangeSlider
              label="Turn Penalty (m-equiv)"
              value={engineConfig.turnPenalty}
              min={50}
              max={500}
              step={50}
              unit=" m"
              onChange={(v) => handleEngineChange('turnPenalty', v)}
            />
            <RangeSlider
              label="Default Stop Duration (min)"
              value={engineConfig.stopDurationMin}
              min={5}
              max={90}
              step={5}
              unit=" min"
              onChange={(v) => handleEngineChange('stopDurationMin', v)}
            />

            {/* Driving Side — locked */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-textMain">Driving Side</span>
                <span className="text-sm font-mono text-muted">Left</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-secondary rounded-xl border border-borderSubtle">
                <Shield size={14} className="text-warning flex-shrink-0" />
                <p className="text-xs text-muted">
                  India drives on the left — cannot change in this demo
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleApplyEngine}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-accent text-background hover:bg-lime-400 transition-colors"
            >
              Apply Configuration
            </button>
            <button
              onClick={handleResetEngine}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-muted hover:text-textMain border border-borderSubtle hover:border-borderStrong transition-colors"
            >
              <RotateCcw size={13} />
              Reset to Defaults
            </button>
            <SaveFlash show={engineSaved} />
          </div>
        </SectionCard>

        {/* ── Section 3: Corridor Config ──────────────────────────────── */}
        <SectionCard title="Corridor Config" icon={Sliders}>
          <div className="space-y-4">
            {/* Ahead-only toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-textMain">Ahead-only filter</p>
                <p className="text-xs text-muted mt-0.5">
                  Only show restaurants ahead of vehicle
                </p>
              </div>
              <button
                onClick={() =>
                  handleEngineChange('aheadOnly', !engineConfig.aheadOnly)
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  engineConfig.aheadOnly ? 'bg-accent' : 'bg-borderStrong'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                    engineConfig.aheadOnly ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Behind tolerance */}
            <RangeSlider
              label="Behind Tolerance (m)"
              value={engineConfig.behindToleranceMeters}
              min={0}
              max={2000}
              step={100}
              unit=" m"
              disabled={engineConfig.aheadOnly}
              onChange={(v) => handleEngineChange('behindToleranceMeters', v)}
            />
            {engineConfig.aheadOnly && (
              <p className="text-xs text-muted -mt-2">
                Enable "Ahead-only filter" off to adjust behind tolerance
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleApplyEngine}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-accent text-background hover:bg-lime-400 transition-colors"
            >
              Apply Corridor Config
            </button>
          </div>
        </SectionCard>

        {/* ── Section 4: Data Sources ─────────────────────────────────── */}
        <SectionCard title="Data Sources" icon={Info}>
          <div className="space-y-3">
            {[
              {
                label: 'OSRM',
                value: 'Public API (demo.project-osrm.org)',
                badge: 'Rate Limited',
                badgeColor: 'text-warning border-warning',
              },
              {
                label: 'Road Graph',
                value: 'Hand-built sample graph (14 nodes, ~20 edges)',
                badge: 'Sample/Demo',
                badgeColor: 'text-muted border-borderSubtle',
              },
              {
                label: 'Restaurants',
                value: '12 seed restaurants',
                badge: 'Sample/Demo',
                badgeColor: 'text-muted border-borderSubtle',
              },
            ].map(({ label, value, badge, badgeColor }) => (
              <div
                key={label}
                className="flex items-start justify-between gap-4 py-2 border-b border-borderSubtle last:border-0"
              >
                <div>
                  <p className="text-sm font-mono text-textMain">{label}</p>
                  <p className="text-xs text-muted mt-0.5">{value}</p>
                </div>
                <span
                  className={`text-xs border rounded-full px-2 py-0.5 whitespace-nowrap flex-shrink-0 ${badgeColor}`}
                >
                  {badge}
                </span>
              </div>
            ))}

            {/* Supabase */}
            <div className="flex items-start justify-between gap-4 py-2">
              <div>
                <p className="text-sm font-mono text-textMain">Supabase</p>
                <p className="text-xs text-muted mt-0.5">
                  {supabaseConfigured
                    ? import.meta.env.VITE_SUPABASE_URL
                    : 'Not configured — using LocalSeedRepository'}
                </p>
              </div>
              <span
                className={`text-xs border rounded-full px-2 py-0.5 whitespace-nowrap flex-shrink-0 ${
                  supabaseConfigured
                    ? 'text-success border-success'
                    : 'text-muted border-borderSubtle'
                }`}
              >
                {supabaseConfigured ? 'Connected' : 'Not Configured'}
              </span>
            </div>
          </div>
        </SectionCard>

        {/* ── Reset All ───────────────────────────────────────────────── */}
        <div className="flex justify-center pt-2 pb-8">
          <button
            onClick={handleResetAll}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm text-danger border border-danger/40 hover:bg-danger/10 transition-colors"
          >
            <RotateCcw size={14} />
            Reset All to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
