/**
 * @file demo.js
 * CLI runner for Phase 2: demonstrates full pitstop intelligence pipeline on the
 * Mumbai -> Pune Expressway demo dataset.
 *
 * Run with: npm run demo
 */

import { LocalSeedRepository } from '../src/data/LocalSeedRepository.js';
import { recommendPitstops } from '../src/engine/recommendationEngine.js';

async function runDemo() {
  console.log('================================================================');
  console.log('   WAYDINE: SMART PITSTOP INTELLIGENCE & ROUTE OPTIMIZATION    ');
  console.log('         Phase 2 Demo: Mumbai -> Pune Expressway (NH-48)        ');
  console.log('================================================================\n');

  const repo = new LocalSeedRepository();

  const demoRoute = await repo.getDemoRoute();
  const demoParams = await repo.getDemoParameters();
  const roadGraph = await repo.getRoadGraph();
  const restaurants = await repo.getRestaurants();

  console.log(`📍 ROUTE: ${demoRoute.name}`);
  console.log(`📏 Distance: ${(demoRoute.totalDistanceMeters / 1000).toFixed(1)} km | Est. Duration: ${Math.round(demoRoute.totalDurationSeconds / 60)} min`);
  console.log(`🏷️  Data Source Provenance: "${demoRoute.dataSource}"`);
  console.log(`🚗 Vehicle Position: [${demoParams.vehiclePosition.join(', ')}] (Kalamboli Toll KM 25)`);
  console.log(`⏰ Departure Time: ${demoParams.departureTimeIso} (ETA Base)`);
  console.log(`🔍 Filter: Required Category = "${demoParams.filterRequiredCategory}", Max Detour = ${demoParams.filterMaxDetourMeters} m\n`);

  const departureTime = new Date(demoParams.departureTimeIso);

  const results = recommendPitstops({
    routeCoordinates: demoRoute.coordinates,
    vehiclePosition: demoParams.vehiclePosition,
    restaurants,
    roadGraph,
    vehicleNodeId: demoParams.vehicleNodeId,
    departureTime,
    highwayDurationToVehicleSeconds: demoParams.highwayDurationToVehicleSeconds,
    filters: {
      corridorMeters: 500,
      maxDetourMeters: demoParams.filterMaxDetourMeters,
      requiredCategory: demoParams.filterRequiredCategory
    }
  });

  console.log('----------------------------------------------------------------');
  console.log(`🏆 RANKED ELIGIBLE PITSTOPS (${results.eligible.length} venues)`);
  console.log('----------------------------------------------------------------');

  results.eligible.forEach(item => {
    const r = item.restaurant;
    const d = item.detourResult;
    console.log(`\n#${item.rank} | ${r.name}`);
    console.log(`     Score: ${item.finalScore}/100 | Class: [${d.accessibilityClass}] | Detour: +${d.detourDistanceMeters} m (+${Math.round(d.detourDurationSeconds / 60)} min)`);
    console.log(`     ETA: ${item.eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | Active Categories: ${item.activeCategoriesAtEta.join(', ')}`);
    console.log(`     Data Source: "${r.dataSource}"`);
    console.log(`     Explanation: ${item.explanation}`);
  });

  console.log('\n----------------------------------------------------------------');
  console.log(`🚫 ELIMINATED / REJECTED CANDIDATES (${results.rejected.length} venues)`);
  console.log('----------------------------------------------------------------');

  results.rejected.forEach(item => {
    console.log(`\n❌ ${item.restaurant.name}`);
    console.log(`     Reason Code: ${item.reasonCode}`);
    console.log(`     Message: ${item.reasonMessage}`);
    console.log(`     Data Source: "${item.restaurant.dataSource}"`);
  });

  console.log('\n================================================================');
  console.log('        BENCHMARK CASE VERIFICATION SUMMARY                     ');
  console.log('================================================================');

  const topPick = results.eligible[0];
  console.log(`1. Top Ranked Pick: "${topPick?.restaurant.name}" (Designed Rank #1 - Score ${topPick?.finalScore}/100)`);

  const greenFound = results.eligible.find(e => e.restaurant.id === 'rest_01_green');
  console.log(`2. Case 1 (GREEN Carriageway): "${greenFound?.restaurant.name}" -> ${greenFound ? 'ELIGIBLE [GREEN]' : 'Not found'}`);

  const redRejected = results.rejected.find(r => r.restaurant.id === 'rest_02_red');
  console.log(`3. Case 2 (RED Opposite Median): "${redRejected?.restaurant.name}" -> REJECTED [${redRejected?.reasonCode}]`);

  const yellowFound = results.eligible.find(e => e.restaurant.id === 'rest_03_yellow');
  console.log(`4. Case 3 (YELLOW Legal U-Turn): "${yellowFound?.restaurant.name}" -> ${yellowFound ? 'ELIGIBLE [YELLOW]' : 'Not found'}`);

  const excessiveRejected = results.rejected.find(r => r.restaurant.id === 'rest_04_excessive_detour');
  console.log(`5. Case 4 (Long Diversion): "${excessiveRejected?.restaurant.name}" -> REJECTED [${excessiveRejected?.reasonCode}]`);

  const closedRejected = results.rejected.find(r => r.restaurant.id === 'rest_05_closed_eta');
  console.log(`6. Case 5 (Closed at ETA): "${closedRejected?.restaurant.name}" -> REJECTED [${closedRejected?.reasonCode}]`);

  const noLunchRejected = results.rejected.find(r => r.restaurant.id === 'rest_06_no_lunch');
  console.log(`7. Case 6 (Lunch Unavailable): "${noLunchRejected?.restaurant.name}" -> REJECTED [${noLunchRejected?.reasonCode}]`);

  const midnightFound = results.eligible.find(e => e.restaurant.id === 'rest_09_midnight');
  console.log(`8. Case 9 (Closing Past Midnight): "${midnightFound?.restaurant.name}" -> ${midnightFound ? 'ELIGIBLE (Handled Midnight Shift)' : 'Not found'}`);

  console.log('\n✅ Demo simulation completed successfully with reproducible results.\n');
}

runDemo().catch(err => {
  console.error('Demo error:', err);
  process.exit(1);
});
