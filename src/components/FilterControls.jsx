import React from 'react';
import { SlidersHorizontal, Clock, Coffee, ShieldAlert, Check, Car } from 'lucide-react';

const CATEGORY_PRESETS = [
  { id: '', label: 'All Categories' },
  { id: 'Coffee', label: 'Coffee & Cafe' },
  { id: 'Breakfast', label: 'Breakfast / Diner' },
  { id: 'Burgers', label: 'Burgers / Fast Food' },
  { id: 'Pizza', label: 'Pizza & Italian' },
  { id: 'Quick Bites', label: 'Quick Bites' }
];

export function FilterControls({ filters, totalCandidatesCount, returnedCount }) {
  const {
    maxDetourMinutes,
    setMaxDetourMinutes,
    preferredCategory,
    setPreferredCategory,
    requireDriveThru,
    setRequireDriveThru,
    requireOpenAtEta,
    setRequireOpenAtEta,
    allowedAccessClasses,
    setAllowedAccessClasses,
    departureTime,
    setDepartureTime
  } = filters;

  const toggleAccessClass = (cls) => {
    if (allowedAccessClasses.includes(cls)) {
      if (allowedAccessClasses.length > 1) {
        setAllowedAccessClasses(allowedAccessClasses.filter(c => c !== cls));
      }
    } else {
      setAllowedAccessClasses([...allowedAccessClasses, cls]);
    }
  };

  const handleTimeChange = (e) => {
    const [hours, minutes] = e.target.value.split(':').map(Number);
    const updated = new Date(departureTime);
    updated.setHours(hours, minutes, 0, 0);
    setDepartureTime(updated);
  };

  const timeString = `${String(departureTime.getHours()).padStart(2, '0')}:${String(departureTime.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="bg-card/90 backdrop-blur-md rounded-2xl border border-borderSubtle p-4 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-borderSubtle pb-2.5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-bold text-textMain">Pitstop Intelligence Controls</h3>
        </div>
        <span className="text-[11px] font-mono text-muted bg-secondary px-2 py-0.5 rounded-lg border border-borderSubtle">
          Showing <span className="text-accent font-bold">{returnedCount}</span> / {totalCandidatesCount} in corridor
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Max Detour Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted font-medium">Max Extra Detour</span>
            <span className="font-mono text-accent font-bold">+{maxDetourMinutes} min</span>
          </div>
          <input
            type="range"
            min="3"
            max="30"
            step="1"
            value={maxDetourMinutes}
            onChange={(e) => setMaxDetourMinutes(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
          />
          <div className="flex justify-between text-[10px] text-muted font-mono">
            <span>3 min</span>
            <span>15 min</span>
            <span>30 min</span>
          </div>
        </div>

        {/* Departure Time (Task 3 ETA) */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted font-medium flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-accent" />
            <span>Departure Time (ETA Base)</span>
          </label>
          <input
            type="time"
            value={timeString}
            onChange={handleTimeChange}
            className="w-full bg-secondary border border-borderSubtle rounded-xl px-3 py-1.5 text-xs font-mono text-textMain focus:outline-none focus:border-accent"
          />
          <span className="text-[10px] text-muted block">Tests breakfast, lunch, or late-night window</span>
        </div>

        {/* Food Category Selector */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted font-medium flex items-center gap-1.5">
            <Coffee className="w-3.5 h-3.5 text-accent" />
            <span>Category Preference</span>
          </label>
          <select
            value={preferredCategory}
            onChange={(e) => setPreferredCategory(e.target.value)}
            className="w-full bg-secondary border border-borderSubtle rounded-xl px-3 py-1.5 text-xs text-textMain focus:outline-none focus:border-accent"
          >
            {CATEGORY_PRESETS.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Toggles */}
        <div className="flex flex-col justify-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-textMain select-none">
            <input
              type="checkbox"
              checked={requireDriveThru}
              onChange={(e) => setRequireDriveThru(e.target.checked)}
              className="rounded bg-secondary border-borderSubtle text-accent focus:ring-accent"
            />
            <span className="font-medium">Drive-Thru Only</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-textMain select-none">
            <input
              type="checkbox"
              checked={requireOpenAtEta}
              onChange={(e) => setRequireOpenAtEta(e.target.checked)}
              className="rounded bg-secondary border-borderSubtle text-accent focus:ring-accent"
            />
            <span className="font-medium">Must Be Open at Projected ETA</span>
          </label>
        </div>
      </div>

      {/* Accessibility Class Filter Pills */}
      <div className="pt-2 border-t border-borderSubtle flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-muted font-medium">Filter Accessibility:</span>
        {[
          { id: 'GREEN', label: 'GREEN (Direct Ramp)', color: 'border-success text-success bg-success/10' },
          { id: 'YELLOW', label: 'YELLOW (Overpass / Turn)', color: 'border-warning text-warning bg-warning/10' },
          { id: 'RED', label: 'RED (Median U-turn)', color: 'border-danger text-danger bg-danger/10' },
          { id: 'Unverified', label: 'Unverified', color: 'border-muted text-muted bg-muted/10' }
        ].map(item => {
          const isActive = allowedAccessClasses.includes(item.id);
          return (
            <button
              key={item.id}
              onClick={() => toggleAccessClass(item.id)}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all flex items-center gap-1.5 ${
                isActive
                  ? item.color
                  : 'border-borderSubtle text-muted/60 bg-secondary/50 line-through'
              }`}
            >
              {isActive && <Check className="w-3 h-3" />}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
