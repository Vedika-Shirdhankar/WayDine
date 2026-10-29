import React from 'react';
import { Play, Pause, RotateCcw, FastForward, Car, Compass } from 'lucide-react';

export function SimulationBar({
  progressPercent,
  isPlaying,
  speedMultiplier,
  setSpeedMultiplier,
  onTogglePlay,
  onReset,
  onSeekPercent,
  vehicleDistanceMeters,
  totalRouteMeters
}) {
  const currentKm = (vehicleDistanceMeters / 1000).toFixed(1);
  const totalKm = (totalRouteMeters / 1000).toFixed(1);

  return (
    <div className="bg-card/90 backdrop-blur-md rounded-2xl border border-borderSubtle p-4 shadow-xl space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-accent/15 text-accent border border-accent/30 shadow-glow-accent">
            <Car className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-textMain flex items-center gap-2">
              Route Simulation Controller
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/20 text-accent font-semibold">
                Task 1 & 3 Live Test
              </span>
            </h4>
            <p className="text-[11px] text-muted">
              Move vehicle forward to watch passed restaurants disappear and arrival ETAs advance dynamically.
            </p>
          </div>
        </div>

        {/* Speed multipliers */}
        <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-xl border border-borderSubtle self-start sm:self-auto">
          {[1, 5, 10, 25].map(multiplier => (
            <button
              key={multiplier}
              onClick={() => setSpeedMultiplier(multiplier)}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-semibold transition-all ${
                speedMultiplier === multiplier
                  ? 'bg-accent text-background shadow-sm'
                  : 'text-muted hover:text-textMain'
              }`}
            >
              {multiplier}x
            </button>
          ))}
        </div>
      </div>

      {/* Scrubber slider and controls */}
      <div className="flex items-center gap-3">
        {/* Play/Pause */}
        <button
          onClick={onTogglePlay}
          className={`p-2.5 rounded-xl font-bold flex items-center justify-center transition-all ${
            isPlaying
              ? 'bg-warning text-background hover:bg-warning/90'
              : 'bg-accent text-background hover:bg-accentHover shadow-glow-accent'
          }`}
          title={isPlaying ? 'Pause simulation' : 'Play simulation'}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        {/* Reset */}
        <button
          onClick={onReset}
          className="p-2.5 rounded-xl bg-secondary hover:bg-borderStrong border border-borderSubtle text-muted hover:text-textMain transition-colors"
          title="Reset to departure origin"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Range slider */}
        <div className="flex-1 flex flex-col gap-1">
          <input
            type="range"
            min="0"
            max="100"
            step="0.5"
            value={progressPercent}
            onChange={(e) => onSeekPercent(parseFloat(e.target.value))}
            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
          />
          <div className="flex items-center justify-between text-[11px] font-mono text-muted">
            <span>{currentKm} km traveled ({progressPercent}%)</span>
            <span>Speed: ~90 km/h</span>
            <span>{totalKm} km total</span>
          </div>
        </div>
      </div>
    </div>
  );
}
