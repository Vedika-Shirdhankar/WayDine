import React, { useState, useEffect } from 'react';
import { Sliders, Save, RotateCcw, CheckCircle2 } from 'lucide-react';
import { getRepository } from '../data/restaurantRepository.js';

const DEFAULT_PREFS = {
  maxDetourMeters: 2500,
  preferredCategory: 'Lunch',
  dietaryPreference: '',
  budget: '$$',
  travelMode: 'car',
  autoLoadDemo: true,
  showRejectedOnMap: true,
  preferredCuisines: []
};

const CUISINE_OPTIONS = [
  'North Indian',
  'South Indian',
  'Chinese',
  'Continental',
  'Fast Food',
  'Seafood',
  'Street Food',
  'Desserts',
  'Coffee & Beverages'
];

const MAX_CUISINES = 4;

/**
 * /preferences – user preference form backed by the repository savePreferences call.
 */
export function PreferencesPage() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRepository().getPreferences()
      .then(p => { if (p) setPrefs({ ...DEFAULT_PREFS, ...p, preferredCuisines: p.preferredCuisines || [] }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    try {
      await getRepository().savePreferences('default_user', prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('[PreferencesPage] save failed:', err);
    }
  };

  const handleReset = () => {
    setPrefs(DEFAULT_PREFS);
    setSaved(false);
  };

  const toggleCuisine = (cuisine) => {
    setPrefs(p => {
      const current = p.preferredCuisines || [];
      if (current.includes(cuisine)) {
        return { ...p, preferredCuisines: current.filter(c => c !== cuisine) };
      }
      if (current.length >= MAX_CUISINES) return p; // cap at 4
      return { ...p, preferredCuisines: [...current, cuisine] };
    });
  };

  function Field({ label, children }) {
    return (
      <div className="space-y-1">
        <label className="text-[11px] text-muted font-medium">{label}</label>
        {children}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-muted text-xs animate-pulse">
        Loading preferences…
      </div>
    );
  }

  const selectedCuisines = prefs.preferredCuisines || [];

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent border border-accent/30 flex items-center justify-center">
          <Sliders className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-extrabold text-textMain">Preferences</h1>
          <p className="text-[11px] text-muted">Personalize your journey planning defaults</p>
        </div>
      </div>

      <div className="bg-card border border-borderSubtle rounded-2xl p-5 space-y-5">
        {/* Max detour */}
        <Field label={`Max Acceptable Detour: ${prefs.maxDetourMeters} m`}>
          <input
            type="range" min="300" max="4000" step="100"
            value={prefs.maxDetourMeters}
            onChange={e => setPrefs(p => ({ ...p, maxDetourMeters: Number(e.target.value) }))}
            className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-accent"
          />
          <div className="flex justify-between text-[10px] text-muted font-mono">
            <span>300 m (Strict)</span><span>4000 m (Lenient)</span>
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Default Food Category">
            <select
              value={prefs.preferredCategory}
              onChange={e => setPrefs(p => ({ ...p, preferredCategory: e.target.value }))}
              className="w-full bg-secondary border border-borderSubtle rounded-xl px-3 py-2 text-xs text-textMain focus:outline-none focus:border-accent"
            >
              {['All','Breakfast','Lunch','Dinner','Quick Bites','Coffee','Burgers','Pizza'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>

          <Field label="Dietary Preference">
            <select
              value={prefs.dietaryPreference}
              onChange={e => setPrefs(p => ({ ...p, dietaryPreference: e.target.value }))}
              className="w-full bg-secondary border border-borderSubtle rounded-xl px-3 py-2 text-xs text-textMain focus:outline-none focus:border-accent"
            >
              <option value="">Any</option>
              <option value="Vegetarian">Vegetarian 🌿</option>
              <option value="Vegan">Vegan 🌱</option>
              <option value="Jain">Jain</option>
              <option value="Halal">Halal ☾</option>
              <option value="Gluten-Free">Gluten-Free</option>
            </select>
          </Field>

          <Field label="Budget Tier">
            <div className="grid grid-cols-4 gap-2">
              {['$','$$','$$$','$$$$'].map(t => (
                <button
                  key={t}
                  onClick={() => setPrefs(p => ({ ...p, budget: t }))}
                  className={`py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                    prefs.budget === t
                      ? 'bg-accent text-background shadow-glow-accent'
                      : 'bg-secondary border border-borderSubtle text-muted hover:text-textMain'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Travel Mode">
            <select
              value={prefs.travelMode}
              onChange={e => setPrefs(p => ({ ...p, travelMode: e.target.value }))}
              className="w-full bg-secondary border border-borderSubtle rounded-xl px-3 py-2 text-xs text-textMain focus:outline-none focus:border-accent"
            >
              <option value="car">Car (Default)</option>
              <option value="express">Highway Express</option>
              <option value="truck">Commercial Truck</option>
            </select>
          </Field>
        </div>

        {/* Preferred Cuisines */}
        <div className="space-y-2 pt-3 border-t border-borderSubtle">
          <div className="flex items-center justify-between">
            <label className="text-[11px] text-muted font-medium">
              Preferred Cuisines
            </label>
            <span className="text-[10px] font-mono text-muted">
              {selectedCuisines.length}/{MAX_CUISINES} selected
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {CUISINE_OPTIONS.map(cuisine => {
              const isSelected = selectedCuisines.includes(cuisine);
              const isDisabled = !isSelected && selectedCuisines.length >= MAX_CUISINES;
              return (
                <button
                  key={cuisine}
                  onClick={() => toggleCuisine(cuisine)}
                  disabled={isDisabled}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-medium transition-all text-center ${
                    isSelected
                      ? 'bg-accent text-background shadow-glow-accent'
                      : isDisabled
                      ? 'bg-secondary border border-borderSubtle text-muted/40 cursor-not-allowed'
                      : 'bg-secondary border border-borderSubtle text-muted hover:text-textMain hover:border-accent/50'
                  }`}
                >
                  {cuisine}
                </button>
              );
            })}
          </div>
          {selectedCuisines.length >= MAX_CUISINES && (
            <p className="text-[10px] text-warning">Max {MAX_CUISINES} cuisines selected. Deselect one to change.</p>
          )}
        </div>

        {/* Toggles */}
        <div className="space-y-3 pt-3 border-t border-borderSubtle">
          {[
            { key: 'autoLoadDemo',       label: 'Auto-load demo journey on startup' },
            { key: 'showRejectedOnMap',  label: 'Show eliminated restaurants on map' }
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between cursor-pointer">
              <span className="text-xs text-textMain">{label}</span>
              <div
                onClick={() => setPrefs(p => ({ ...p, [key]: !p[key] }))}
                className={`w-10 h-5 rounded-full transition-all relative cursor-pointer ${
                  prefs[key] ? 'bg-accent' : 'bg-secondary border border-borderSubtle'
                }`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-background shadow transition-all ${prefs[key] ? 'left-5' : 'left-0.5'}`} />
              </div>
            </label>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-3 border-t border-borderSubtle">
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-accentHover text-background text-xs font-bold flex items-center justify-center gap-2 shadow-glow-accent transition-all"
          >
            {saved ? <><CheckCircle2 className="w-4 h-4" />Saved!</> : <><Save className="w-4 h-4" />Save Preferences</>}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2.5 rounded-xl bg-secondary border border-borderSubtle text-muted hover:text-textMain text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <RotateCcw className="w-4 h-4" />Reset
          </button>
        </div>
      </div>

      <p className="text-[10px] text-muted text-center">
        Preferences are stored in localStorage (no account required). Source: <strong>LocalSeedRepository</strong>.
      </p>
    </div>
  );
}
