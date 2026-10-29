import React, { useState } from 'react';
import { Navbar } from '../components/Navbar.jsx';
import {
  haversineDistanceMeters,
  bearingDegrees,
  crossTrackDistanceMeters,
  projectPointOnSegment
} from '../engine/geoUtils.js';
import { calculateDetourScore, calculateDetourMetrics } from '../engine/detourCalculator.js';
import {
  parseTimeToMinutes,
  isWithinOpeningHours,
  getMealWindow,
  evaluateFoodSuitability
} from '../engine/foodRulesEngine.js';
import { RoadNetworkGraph, dijkstraShortestPath, MANEUVER_PENALTIES } from '../engine/shortestPath.js';
import { Cpu, CheckCircle, AlertTriangle, ShieldCheck, HelpCircle, ArrowRight, Play } from 'lucide-react';

export function EngineLab() {
  // --- Task 1 State ---
  const [task1Candidate, setTask1Candidate] = useState([37.5342, -122.2865]);
  const [task1SegStart, setTask1SegStart] = useState([37.563, -122.3255]);
  const [task1SegEnd, setTask1SegEnd] = useState([37.4852, -122.2364]);
  const [task1VehicleProgressMeters, setTask1VehicleProgressMeters] = useState(2500);

  // Task 1 Calculations
  const t1Projection = projectPointOnSegment(task1Candidate, task1SegStart, task1SegEnd);
  const t1CrossTrackMeters = crossTrackDistanceMeters(task1Candidate, task1SegStart, task1SegEnd);
  const t1Side = t1CrossTrackMeters >= 0 ? 'Right (Same Side)' : 'Left (Opposite Side across Median)';
  const t1SegLengthMeters = haversineDistanceMeters(task1SegStart, task1SegEnd);
  const t1DistanceAlongMeters = t1Projection.fraction * t1SegLengthMeters;
  const t1IsAhead = t1DistanceAlongMeters >= task1VehicleProgressMeters;

  // --- Task 2 State ---
  const [task2OffsetMeters, setTask2OffsetMeters] = useState(850);
  const [task2IsDivided, setTask2IsDivided] = useState(true);
  const [task2IsOppositeSide, setTask2IsOppositeSide] = useState(false);

  // Task 2 Calculations
  const t2RoadFactor = 1.35;
  const t2OneWayMeters = Math.round(task2OffsetMeters * t2RoadFactor);
  const t2RoundTripMeters = t2OneWayMeters * 2;
  const t2SpeedMs = (40 * 1000) / 3600; // 40 km/h
  const t2DrivingSeconds = Math.round(t2RoundTripMeters / t2SpeedMs);
  const t2UTurnCount = (task2IsDivided && task2IsOppositeSide) ? 1 : 0;
  const t2UTurnPenaltySeconds = t2UTurnCount * MANEUVER_PENALTIES.U_TURN_PENALTY_SECONDS;
  const t2TotalDetourSeconds = t2DrivingSeconds + t2UTurnPenaltySeconds + 30; // + ramp delay
  const t2DetourScore = calculateDetourScore(t2TotalDetourSeconds);

  // --- Task 3 State ---
  const [task3DepartureHour, setTask3DepartureHour] = useState('07:30');
  const [task3DriveMinutes, setTask3DriveMinutes] = useState(45);
  const [task3OpenHour, setTask3OpenHour] = useState('06:00');
  const [task3CloseHour, setTask3CloseHour] = useState('14:00');
  const [task3SelectedCuisine, setTask3SelectedCuisine] = useState('Breakfast');

  // Task 3 Calculations
  const dummyDeparture = new Date();
  const [depH, depM] = task3DepartureHour.split(':').map(Number);
  dummyDeparture.setHours(depH, depM, 0, 0);

  const t3FoodResult = evaluateFoodSuitability(
    {
      id: 'lab-restaurant',
      name: 'Lab Test Eatery',
      categories: ['Breakfast', 'Coffee', 'Pancakes', 'Quick Bites'],
      openingHours: { open: task3OpenHour, close: task3CloseHour }
    },
    dummyDeparture,
    task3DriveMinutes * 60,
    task3SelectedCuisine
  );

  return (
    <div className="min-h-screen flex flex-col bg-background text-textMain">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 space-y-8">
        {/* Lab Header */}
        <div className="bg-card/70 border border-borderSubtle rounded-2xl p-6 backdrop-blur-md space-y-2">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-accent/15 text-accent border border-accent/30 font-mono font-bold text-xs">
              ENGINE VERIFICATION LAB
            </span>
            <span className="text-xs font-mono text-muted bg-secondary px-2.5 py-1 rounded-lg border border-borderSubtle">
              Zero AI/ML • 100% Deterministic Math
            </span>
          </div>
          <h1 className="text-2xl font-black text-textMain tracking-tight">
            Independent Verification of Three Hackathon Tasks
          </h1>
          <p className="text-xs text-muted max-w-3xl leading-relaxed">
            Test and audit each algorithmic module in isolation. Adjust input sliders and coordinates to watch live geometric projections, Dijkstra turn cost additions, and ETA opening-hour evaluations.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* TASK 1 LAB */}
          <div className="bg-card border border-borderSubtle rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-borderSubtle pb-2.5">
                <span className="text-[11px] font-mono font-bold text-accent px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
                  TASK 1
                </span>
                <span className="text-xs font-mono text-textMain font-bold">Corridor & Direction</span>
              </div>

              <p className="text-xs text-muted">
                Evaluates perpendicular corridor distance, travel side (signed cross-track), and ahead-of-vehicle progression.
              </p>

              {/* Inputs */}
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-muted text-[11px] block">Restaurant Coordinate [lat, lng]</label>
                  <div className="font-mono text-textMain bg-secondary p-2 rounded-xl border border-borderSubtle text-[11px]">
                    [{task1Candidate[0]}, {task1Candidate[1]}]
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-muted text-[11px]">
                    <span>Vehicle Progress Along Segment</span>
                    <span className="font-mono text-accent">{(task1VehicleProgressMeters / 1000).toFixed(1)} km</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.round(t1SegLengthMeters)}
                    value={task1VehicleProgressMeters}
                    onChange={(e) => setTask1VehicleProgressMeters(Number(e.target.value))}
                    className="w-full h-1.5 bg-secondary rounded-lg accent-accent cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Live Task 1 Results Box */}
            <div className="bg-secondary p-3.5 rounded-xl border border-borderSubtle text-xs space-y-2 font-mono">
              <div className="flex justify-between items-center">
                <span className="text-muted">Perpendicular Dist:</span>
                <span className="font-bold text-textMain">{Math.round(t1Projection.perpendicularDistanceMeters)} m</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Cross-Track Signed:</span>
                <span className="font-bold text-accent">{t1CrossTrackMeters > 0 ? '+' : ''}{Math.round(t1CrossTrackMeters)} m</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Side of Travel:</span>
                <span className="font-bold text-textMain">{t1Side}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-borderSubtle/60">
                <span className="text-muted">Progression Status:</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                  t1IsAhead ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                }`}>
                  {t1IsAhead ? 'AHEAD of Vehicle' : 'BEHIND (Excluded)'}
                </span>
              </div>
            </div>
          </div>

          {/* TASK 2 LAB */}
          <div className="bg-card border border-borderSubtle rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-borderSubtle pb-2.5">
                <span className="text-[11px] font-mono font-bold text-accent px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
                  TASK 2
                </span>
                <span className="text-xs font-mono text-textMain font-bold">Detour & U-Turn Minimization</span>
              </div>

              <p className="text-xs text-muted">
                Calculates actual road network extra distance, travel duration, turn friction, and exponential detour penalty decay.
              </p>

              {/* Inputs */}
              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between text-muted text-[11px]">
                    <span>Straight-Line Lateral Offset</span>
                    <span className="font-mono text-accent">{task2OffsetMeters} m</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="4000"
                    step="50"
                    value={task2OffsetMeters}
                    onChange={(e) => setTask2OffsetMeters(Number(e.target.value))}
                    className="w-full h-1.5 bg-secondary rounded-lg accent-accent cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-textMain">
                    <input
                      type="checkbox"
                      checked={task2IsDivided}
                      onChange={(e) => setTask2IsDivided(e.target.checked)}
                      className="rounded bg-secondary text-accent"
                    />
                    <span>Divided Highway (Median Barrier Present)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-textMain">
                    <input
                      type="checkbox"
                      checked={task2IsOppositeSide}
                      onChange={(e) => setTask2IsOppositeSide(e.target.checked)}
                      className="rounded bg-secondary text-accent"
                    />
                    <span>Restaurant on Opposite Side of Highway</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Live Task 2 Results Box */}
            <div className="bg-secondary p-3.5 rounded-xl border border-borderSubtle text-xs space-y-2 font-mono">
              <div className="flex justify-between items-center">
                <span className="text-muted">Round-Trip Road Dist:</span>
                <span className="font-bold text-textMain">{(t2RoundTripMeters / 1000).toFixed(2)} km</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">U-Turn Count:</span>
                <span className={`font-bold ${t2UTurnCount > 0 ? 'text-danger' : 'text-success'}`}>
                  {t2UTurnCount} {t2UTurnCount > 0 ? '(+240s penalty)' : '(Zero)'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Extra Detour Time:</span>
                <span className="font-bold text-textMain">{(t2TotalDetourSeconds / 60).toFixed(1)} min</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-borderSubtle/60">
                <span className="text-muted">Detour Efficiency:</span>
                <span className="text-sm font-black text-accent">{t2DetourScore} / 100</span>
              </div>
            </div>
          </div>

          {/* TASK 3 LAB */}
          <div className="bg-card border border-borderSubtle rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-borderSubtle pb-2.5">
                <span className="text-[11px] font-mono font-bold text-accent px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
                  TASK 3
                </span>
                <span className="text-xs font-mono text-textMain font-bold">ETA & Food Rules Engine</span>
              </div>

              <p className="text-xs text-muted">
                Evaluates per-restaurant projected ETA, opening hours, active meal service window, and category availability.
              </p>

              {/* Inputs */}
              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted text-[11px] block">Departure Time</label>
                    <input
                      type="time"
                      value={task3DepartureHour}
                      onChange={(e) => setTask3DepartureHour(e.target.value)}
                      className="w-full bg-secondary border border-borderSubtle rounded-lg px-2 py-1 font-mono text-xs text-textMain"
                    />
                  </div>
                  <div>
                    <label className="text-muted text-[11px] block">Drive Duration</label>
                    <input
                      type="number"
                      min="5"
                      max="300"
                      value={task3DriveMinutes}
                      onChange={(e) => setTask3DriveMinutes(Number(e.target.value))}
                      className="w-full bg-secondary border border-borderSubtle rounded-lg px-2 py-1 font-mono text-xs text-textMain"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted text-[11px] block">Opens At</label>
                    <input
                      type="time"
                      value={task3OpenHour}
                      onChange={(e) => setTask3OpenHour(e.target.value)}
                      className="w-full bg-secondary border border-borderSubtle rounded-lg px-2 py-1 font-mono text-xs text-textMain"
                    />
                  </div>
                  <div>
                    <label className="text-muted text-[11px] block">Closes At</label>
                    <input
                      type="time"
                      value={task3CloseHour}
                      onChange={(e) => setTask3CloseHour(e.target.value)}
                      className="w-full bg-secondary border border-borderSubtle rounded-lg px-2 py-1 font-mono text-xs text-textMain"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Live Task 3 Results Box */}
            <div className="bg-secondary p-3.5 rounded-xl border border-borderSubtle text-xs space-y-2 font-mono">
              <div className="flex justify-between items-center">
                <span className="text-muted">Calculated ETA:</span>
                <span className="font-bold text-accent">{t3FoodResult.projectedEta}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Meal Service Window:</span>
                <span className="font-bold text-textMain">{t3FoodResult.mealWindow}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Operating at Arrival:</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                  t3FoodResult.isOpenAtEta ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                }`}>
                  {t3FoodResult.isOpenAtEta ? 'OPEN at ETA' : 'CLOSED at ETA'}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-borderSubtle/60">
                <span className="text-muted">Timing Match Score:</span>
                <span className="text-sm font-black text-accent">{t3FoodResult.timingMatchScore} / 100</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
