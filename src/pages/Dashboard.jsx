import React from 'react';
import { JourneyPlanner } from '../components/dashboard/JourneyPlanner.jsx';
import { DashboardMap } from '../components/dashboard/DashboardMap.jsx';
import { JourneySummary } from '../components/dashboard/JourneySummary.jsx';

/**
 * Navigation Dashboard – three-column layout.
 *  Left  : Journey Planner (route inputs, vehicle slider, filters)
 *  Centre: Leaflet map with route, markers, corridor overlay
 *  Right : Journey Summary + top-3 recommendations
 */
export function Dashboard() {
  return (
    <div className="p-4 lg:p-5 space-y-0">
      {/* 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_320px] xl:grid-cols-[340px_1fr_340px] gap-4 items-start">
        {/* LEFT – Journey Planner */}
        <div className="space-y-4">
          <JourneyPlanner />
        </div>

        {/* CENTRE – Interactive Map */}
        <div className="h-[calc(100vh-88px)] min-h-[520px]">
          <DashboardMap />
        </div>

        {/* RIGHT – Journey Summary */}
        <div className="space-y-4 max-h-[calc(100vh-88px)] overflow-y-auto pr-0.5">
          <JourneySummary />
        </div>
      </div>
    </div>
  );
}
