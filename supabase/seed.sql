-- =====================================================================
-- WayDine Seed Data (Mumbai - Pune Expressway Corridor NH-48)
-- All rows are marked as sample demo data (data_source = 'sample-demo').
-- Safe to re-run multiple times (idempotent ON CONFLICT clauses).
-- =====================================================================

-- 1. Highway Corridor Definition
INSERT INTO public.roads (id, name, road_type, is_divided, speed_limit_kmh)
VALUES 
  ('road_mumbai_pune_exp', 'Mumbai-Pune Expressway (NH-48) [Sample Data]', 'highway', true, 90)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  speed_limit_kmh = EXCLUDED.speed_limit_kmh;

-- 2. Road Network Segments (Edges & Geometries)
INSERT INTO public.road_segments (
  id, road_id, from_node_id, to_node_id,
  from_lat, from_lng, to_lat, to_lng,
  distance_meters, duration_seconds, speed_limit_kmh,
  is_one_way, is_u_turn, is_turn, has_median_barrier, is_forbidden
) VALUES
  ('seg_01', 'road_mumbai_pune_exp', 'NODE_MUMBAI_START', 'NODE_KALAMBOLI', 19.076000, 72.877700, 19.014400, 73.102500, 25000, 1200, 90, true, false, false, false, false),
  ('seg_02', 'road_mumbai_pune_exp', 'NODE_KALAMBOLI', 'NODE_KHALAPUR_HWY', 19.014400, 73.102500, 18.835000, 73.308000, 40000, 1800, 90, true, false, false, false, false),
  ('seg_03', 'road_mumbai_pune_exp', 'NODE_KHALAPUR_HWY', 'NODE_KHALAPUR_OFF', 18.835000, 73.308000, 18.835200, 73.308200, 100, 15, 45, true, false, true, false, false),
  ('seg_04', 'road_mumbai_pune_exp', 'NODE_KHALAPUR_OFF', 'REST_01_RAMP', 18.835200, 73.308200, 18.835500, 73.309000, 110, 15, 35, true, false, false, false, false),
  ('seg_05', 'road_mumbai_pune_exp', 'REST_01_RAMP', 'NODE_KHALAPUR_ON', 18.835500, 73.309000, 18.837500, 73.309800, 110, 15, 40, true, false, false, false, false),
  ('seg_06', 'road_mumbai_pune_exp', 'NODE_KHALAPUR_OFF', 'REST_07_ENTRY', 18.835200, 73.308200, 18.836000, 73.308500, 40, 5, 40, true, false, false, false, false),
  ('seg_07', 'road_mumbai_pune_exp', 'REST_07_ENTRY', 'NODE_KHALAPUR_ON', 18.836000, 73.308500, 18.837500, 73.309800, 40, 5, 45, true, false, false, false, false),
  ('seg_08', 'road_mumbai_pune_exp', 'NODE_KHALAPUR_OFF', 'REST_12_RAMP', 18.835200, 73.308200, 18.837000, 73.309500, 120, 15, 35, true, false, false, false, false),
  ('seg_09', 'road_mumbai_pune_exp', 'REST_12_RAMP', 'NODE_KHALAPUR_ON', 18.837000, 73.309500, 18.837500, 73.309800, 120, 15, 40, true, false, false, false, false),
  ('seg_10', 'road_mumbai_pune_exp', 'NODE_KHALAPUR_ON', 'NODE_KHOPOLI_HWY', 18.837500, 73.309800, 18.790000, 73.340000, 15000, 600, 90, true, false, false, false, false),
  ('seg_11', 'road_mumbai_pune_exp', 'NODE_KHALAPUR_HWY', 'NODE_KHOPOLI_HWY', 18.835000, 73.308000, 18.790000, 73.340000, 15200, 608, 90, true, false, false, false, false),
  ('seg_12', 'road_mumbai_pune_exp', 'NODE_KHALAPUR_HWY', 'REST_02_MEDIAN', 18.835000, 73.308000, 18.834000, 73.307000, 50, 0, 0, true, false, false, true, true),
  ('seg_13', 'road_mumbai_pune_exp', 'NODE_KHALAPUR_MUMBAI_BOUND', 'REST_02_MEDIAN', 18.834800, 73.307500, 18.834000, 73.307000, 80, 10, 40, true, false, false, false, false),
  ('seg_14', 'road_mumbai_pune_exp', 'NODE_KHOPOLI_HWY', 'NODE_KHOPOLI_OFF', 18.790000, 73.340000, 18.788000, 73.341000, 200, 25, 40, true, false, true, false, false),
  ('seg_15', 'road_mumbai_pune_exp', 'NODE_KHOPOLI_OFF', 'REST_04_VALLEY', 18.788000, 73.341000, 18.775000, 73.342000, 1700, 210, 35, true, false, false, false, false),
  ('seg_16', 'road_mumbai_pune_exp', 'REST_04_VALLEY', 'NODE_KHOPOLI_OFF', 18.775000, 73.342000, 18.788000, 73.341000, 1700, 210, 35, true, false, false, false, false),
  ('seg_17', 'road_mumbai_pune_exp', 'NODE_KHOPOLI_OFF', 'NODE_LONAVALA_HWY', 18.788000, 73.341000, 18.752500, 73.408600, 14800, 650, 80, true, false, false, false, false),
  ('seg_18', 'road_mumbai_pune_exp', 'NODE_KHOPOLI_HWY', 'NODE_LONAVALA_HWY', 18.790000, 73.340000, 18.752500, 73.408600, 15000, 650, 85, true, false, false, false, false),
  ('seg_19', 'road_mumbai_pune_exp', 'NODE_LONAVALA_HWY', 'NODE_LONAVALA_OFF', 18.752500, 73.408600, 18.752800, 73.409000, 150, 20, 45, true, false, true, false, false),
  ('seg_20', 'road_mumbai_pune_exp', 'NODE_LONAVALA_OFF', 'NODE_LONAVALA_UTURN', 18.752800, 73.409000, 18.753200, 73.410000, 200, 25, 30, true, true, false, false, false),
  ('seg_21', 'road_mumbai_pune_exp', 'NODE_LONAVALA_UTURN', 'REST_03_OVERPASS', 18.753200, 73.410000, 18.753500, 73.411000, 325, 40, 35, true, false, false, false, false),
  ('seg_22', 'road_mumbai_pune_exp', 'REST_03_OVERPASS', 'NODE_LONAVALA_ON', 18.753500, 73.411000, 18.754500, 73.411500, 325, 40, 35, true, false, false, false, false),
  ('seg_23', 'road_mumbai_pune_exp', 'NODE_LONAVALA_OFF', 'REST_09_RAMP', 18.752800, 73.409000, 18.754000, 73.409500, 120, 15, 40, true, false, false, false, false),
  ('seg_24', 'road_mumbai_pune_exp', 'REST_09_RAMP', 'NODE_LONAVALA_ON', 18.754000, 73.409500, 18.754500, 73.411500, 140, 18, 40, true, false, false, false, false),
  ('seg_25', 'road_mumbai_pune_exp', 'NODE_LONAVALA_ON', 'NODE_TALEGAON_HWY', 18.754500, 73.411500, 18.720000, 73.650000, 20000, 800, 90, true, false, false, false, false),
  ('seg_26', 'road_mumbai_pune_exp', 'NODE_LONAVALA_HWY', 'NODE_TALEGAON_HWY', 18.752500, 73.408600, 18.720000, 73.650000, 20200, 808, 90, true, false, false, false, false),
  ('seg_27', 'road_mumbai_pune_exp', 'NODE_TALEGAON_HWY', 'NODE_TALEGAON_OFF', 18.720000, 73.650000, 18.720200, 73.650500, 150, 20, 45, true, false, true, false, false),
  ('seg_28', 'road_mumbai_pune_exp', 'NODE_TALEGAON_OFF', 'REST_05_RAMP', 18.720200, 73.650500, 18.720500, 73.651500, 180, 20, 35, true, false, false, false, false),
  ('seg_29', 'road_mumbai_pune_exp', 'REST_05_RAMP', 'NODE_TALEGAON_ON', 18.720500, 73.651500, 18.721500, 73.652000, 180, 20, 40, true, false, false, false, false),
  ('seg_30', 'road_mumbai_pune_exp', 'NODE_TALEGAON_OFF', 'REST_06_RAMP', 18.720200, 73.650500, 18.721000, 73.651000, 150, 18, 35, true, false, false, false, false),
  ('seg_31', 'road_mumbai_pune_exp', 'REST_06_RAMP', 'NODE_TALEGAON_ON', 18.721000, 73.651000, 18.721500, 73.652000, 150, 18, 40, true, false, false, false, false),
  ('seg_32', 'road_mumbai_pune_exp', 'NODE_TALEGAON_ON', 'NODE_SOMATNE_HWY', 18.721500, 73.652000, 18.685000, 73.720000, 15000, 600, 90, true, false, false, false, false),
  ('seg_33', 'road_mumbai_pune_exp', 'NODE_TALEGAON_HWY', 'NODE_SOMATNE_HWY', 18.720000, 73.650000, 18.685000, 73.720000, 15200, 608, 90, true, false, false, false, false),
  ('seg_34', 'road_mumbai_pune_exp', 'NODE_SOMATNE_HWY', 'NODE_SOMATNE_OFF', 18.685000, 73.720000, 18.685500, 73.720500, 120, 15, 40, true, false, true, false, false),
  ('seg_35', 'road_mumbai_pune_exp', 'NODE_SOMATNE_OFF', 'REST_10_RAMP', 18.685500, 73.720500, 18.686000, 73.721000, 140, 18, 35, true, false, false, false, false),
  ('seg_36', 'road_mumbai_pune_exp', 'REST_10_RAMP', 'NODE_SOMATNE_ON', 18.686000, 73.721000, 18.687500, 73.722500, 140, 18, 40, true, false, false, false, false),
  ('seg_37', 'road_mumbai_pune_exp', 'NODE_SOMATNE_OFF', 'REST_11_RAMP', 18.685500, 73.720500, 18.687000, 73.722000, 190, 22, 35, true, false, false, false, false),
  ('seg_38', 'road_mumbai_pune_exp', 'REST_11_RAMP', 'NODE_SOMATNE_ON', 18.687000, 73.722000, 18.687500, 73.722500, 190, 22, 40, true, false, false, false, false),
  ('seg_39', 'road_mumbai_pune_exp', 'NODE_SOMATNE_ON', 'NODE_PUNE_END', 18.687500, 73.722500, 18.520400, 73.856700, 18000, 720, 90, true, false, false, false, false),
  ('seg_40', 'road_mumbai_pune_exp', 'NODE_SOMATNE_HWY', 'NODE_PUNE_END', 18.685000, 73.720000, 18.520400, 73.856700, 18200, 728, 90, true, false, false, false, false)
ON CONFLICT (id) DO UPDATE SET
  road_id = EXCLUDED.road_id,
  distance_meters = EXCLUDED.distance_meters,
  duration_seconds = EXCLUDED.duration_seconds;

-- 3. Mumbai-Pune Sample Restaurants (All marked with data_source = 'sample-demo')
INSERT INTO public.restaurants (
  id, name, latitude, longitude, address, rating, review_count,
  price_range, cuisine_type, categories, dietary_options,
  has_drive_thru, average_dine_minutes, opening_time, closing_time, data_source
) VALUES
  ('rest_01_green', 'Expressway Food Court Khalapur [Sample Data]', 18.835500, 73.309000, 'KM 65 Expressway Rest Plaza, Khalapur', 4.5, 1420, '$$', 'Multi-Cuisine Court', ARRAY['Lunch', 'Fast Food', 'Quick Bites', 'Coffee'], ARRAY['Vegetarian', 'Halal'], true, 25, '06:00', '23:00', 'sample-demo'),
  ('rest_02_red', 'Median Barrier Mumbai-Bound Dhaba [Sample Data]', 18.834000, 73.307000, 'Opposite Carriageway KM 65, Khalapur', 4.1, 310, '$$', 'Punjabi Dhaba', ARRAY['Lunch', 'Dinner'], ARRAY['Vegetarian'], false, 35, '07:00', '23:00', 'sample-demo'),
  ('rest_03_yellow', 'Lonavala Ghat View Restaurant [Sample Data]', 18.753500, 73.411000, 'Exit Loop 4 Overpass, Lonavala', 4.4, 890, '$$', 'Maharashtrian & North Indian', ARRAY['Lunch', 'Dinner', 'Snacks'], ARRAY['Vegetarian'], false, 35, '10:00', '23:00', 'sample-demo'),
  ('rest_04_excessive_detour', 'Old Khopoli Valley Heritage Inn [Sample Data]', 18.788500, 73.342000, 'Valley Bypass Rd, Khopoli Village', 4.6, 210, '$$$', 'Heritage Dine-In', ARRAY['Lunch', 'Dinner'], ARRAY['Vegetarian', 'Vegan'], false, 60, '11:00', '22:00', 'sample-demo'),
  ('rest_05_closed_eta', 'Twilight Sunset Grill & Bar [Sample Data]', 18.720500, 73.651500, 'Talegaon Overlook KM 115', 4.7, 450, '$$$', 'Bar & Barbecue', ARRAY['Dinner', 'Late Night'], ARRAY[]::TEXT[], false, 45, '18:00', '23:30', 'sample-demo'),
  ('rest_06_no_lunch', 'Sunrise Early Waffle & Bakery [Sample Data]', 18.721000, 73.651000, 'Talegaon Service Rd KM 115', 4.5, 380, '$', 'Bakery & Waffles', ARRAY['Breakfast', 'Pancakes', 'Bakery'], ARRAY['Vegetarian'], true, 20, '06:00', '15:00', 'sample-demo'),
  ('rest_07_top_pick', 'Premier Express Pitstop & Roastery [Sample Data]', 18.836000, 73.308500, 'Expressway Plaza Direct Slip Road KM 65, Khalapur', 4.9, 2100, '$$', 'Gourmet Deli & Specialty Coffee', ARRAY['Lunch', 'Coffee', 'Burgers', 'Quick Bites', 'Sandwiches'], ARRAY['Vegetarian', 'Vegan', 'Halal'], true, 15, '00:00', '23:59', 'sample-demo'),
  ('rest_08_unverified', 'Ghat Mystery Fruit Stand & Tea [Sample Data]', 18.751000, 73.407000, 'Unmarked Mountain Path, Khandala', 4.3, 85, '$', 'Tea & Farm Produce', ARRAY['Lunch', 'Snacks', 'Tea'], ARRAY['Vegetarian', 'Vegan'], false, 10, '08:00', '18:00', 'sample-demo'),
  ('rest_09_midnight', 'Night Owl 24/7 Ghat Diner [Sample Data]', 18.754000, 73.409500, 'Expressway Lonavala Toll Slip, KM 96', 4.5, 780, '$$', 'American Diner & All-Day Breakfast', ARRAY['Lunch', 'Dinner', 'Late Night', 'Burgers'], ARRAY['Vegetarian'], true, 25, '11:00', '03:00', 'sample-demo'),
  ('rest_10_vegan_budget', 'Green Earth Pure Veg & Vegan Cafe [Sample Data]', 18.686000, 73.721000, 'Somatne Toll Plaza Annex KM 130', 4.6, 540, '$', 'Vegan Healthy Bowls', ARRAY['Lunch', 'Salads', 'Bowls', 'Vegetarian'], ARRAY['Vegan', 'Vegetarian', 'Gluten-Free'], false, 20, '08:00', '22:00', 'sample-demo'),
  ('rest_11_seafood_luxury', 'Royal Coastal Seafood Retreat [Sample Data]', 18.687000, 73.722000, 'Somatne Scenic Overlook KM 130', 4.7, 620, '$$$$', 'Coastal Fine Dining', ARRAY['Lunch', 'Dinner', 'Seafood'], ARRAY['Halal', 'Pescatarian'], false, 50, '11:30', '23:00', 'sample-demo'),
  ('rest_12_quick_burgers', 'Express Burger & Shake Drive-Thru [Sample Data]', 18.837000, 73.309500, 'Khalapur Exit Plaza KM 65', 4.3, 490, '$', 'Burgers & Shakes', ARRAY['Lunch', 'Burgers', 'Fast Food', 'Quick Bites'], ARRAY['Halal'], true, 15, '09:00', '23:00', 'sample-demo')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  address = EXCLUDED.address,
  rating = EXCLUDED.rating,
  review_count = EXCLUDED.review_count,
  price_range = EXCLUDED.price_range,
  cuisine_type = EXCLUDED.cuisine_type,
  categories = EXCLUDED.categories,
  dietary_options = EXCLUDED.dietary_options,
  has_drive_thru = EXCLUDED.has_drive_thru,
  average_dine_minutes = EXCLUDED.average_dine_minutes,
  opening_time = EXCLUDED.opening_time,
  closing_time = EXCLUDED.closing_time,
  data_source = EXCLUDED.data_source;

-- 4. Restaurant Access Points (All marked with sample data references)
INSERT INTO public.restaurant_access_points (
  id, restaurant_id, road_node_id, rejoin_node_id,
  latitude, longitude, description, access_class
) VALUES
  ('ap_01', 'rest_01_green', 'REST_01_RAMP', 'NODE_KHALAPUR_ON', 18.835500, 73.309000, 'Sample access point: direct off-ramp at Khalapur Food Plaza', 'GREEN'),
  ('ap_02', 'rest_02_red', 'REST_02_MEDIAN', 'NODE_KHALAPUR_ON', 18.834000, 73.307000, 'Sample access point: opposite carriageway behind median barrier', 'RED'),
  ('ap_03', 'rest_03_yellow', 'REST_03_OVERPASS', 'NODE_LONAVALA_ON', 18.753500, 73.411000, 'Sample access point: Lonavala overpass loop requiring U-turn', 'YELLOW'),
  ('ap_04', 'rest_04_excessive_detour', 'REST_04_VALLEY', 'NODE_LONAVALA_HWY', 18.775000, 73.342000, 'Sample access point: Khopoli valley deep detour off-route', 'YELLOW'),
  ('ap_05', 'rest_05_closed_eta', 'REST_05_RAMP', 'NODE_TALEGAON_ON', 18.720500, 73.651500, 'Sample access point: Talegaon service ramp (evening venue)', 'GREEN'),
  ('ap_06', 'rest_06_no_lunch', 'REST_06_RAMP', 'NODE_TALEGAON_ON', 18.721000, 73.651000, 'Sample access point: Talegaon service ramp (breakfast-only bakery)', 'GREEN'),
  ('ap_07', 'rest_07_top_pick', 'REST_07_ENTRY', 'NODE_KHALAPUR_ON', 18.836000, 73.308500, 'Sample access point: fastest ramp entry at Khalapur Roastery', 'GREEN'),
  ('ap_08', 'rest_08_unverified', 'UNMAPPED_NODE_999', 'UNMAPPED_NODE_999', 18.751000, 73.407000, 'Sample access point: unmarked mountain trail node without road graph data', 'UNVERIFIED'),
  ('ap_09', 'rest_09_midnight', 'REST_09_RAMP', 'NODE_LONAVALA_ON', 18.754000, 73.409500, 'Sample access point: Lonavala toll plaza diner access ramp', 'GREEN'),
  ('ap_10', 'rest_10_vegan_budget', 'REST_10_RAMP', 'NODE_SOMATNE_ON', 18.686000, 73.721000, 'Sample access point: Somatne toll plaza pure veg annex', 'GREEN'),
  ('ap_11', 'rest_11_seafood_luxury', 'REST_11_RAMP', 'NODE_SOMATNE_ON', 18.687000, 73.722000, 'Sample access point: Somatne scenic overlook luxury retreat', 'GREEN'),
  ('ap_12', 'rest_12_quick_burgers', 'REST_12_RAMP', 'NODE_KHALAPUR_ON', 18.837000, 73.309500, 'Sample access point: Khalapur exit drive-thru burger lane', 'GREEN')
ON CONFLICT (id) DO UPDATE SET
  restaurant_id = EXCLUDED.restaurant_id,
  road_node_id = EXCLUDED.road_node_id,
  rejoin_node_id = EXCLUDED.rejoin_node_id,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  access_class = EXCLUDED.access_class;

-- 5. Restaurant Food Availability Windows (Sample Data)
DELETE FROM public.restaurant_food_availability WHERE restaurant_id LIKE 'rest_%';

INSERT INTO public.restaurant_food_availability (
  restaurant_id, window_name, start_hour, end_hour, available_categories
) VALUES
  ('rest_01_green', 'Breakfast Window [Sample Data]', 6, 11, ARRAY['Breakfast', 'Coffee', 'Quick Bites']),
  ('rest_01_green', 'Lunch Window [Sample Data]', 11, 15, ARRAY['Lunch', 'Fast Food', 'Quick Bites']),
  ('rest_01_green', 'Snacks Window [Sample Data]', 15, 18, ARRAY['Snacks', 'Coffee', 'Quick Bites']),
  ('rest_01_green', 'Dinner Window [Sample Data]', 18, 23, ARRAY['Dinner', 'Fast Food', 'Quick Bites']),

  ('rest_02_red', 'Lunch Window [Sample Data]', 11, 16, ARRAY['Lunch', 'Dhaba Staples']),
  ('rest_02_red', 'Dinner Window [Sample Data]', 18, 23, ARRAY['Dinner']),

  ('rest_03_yellow', 'Lunch Window [Sample Data]', 11, 15, ARRAY['Lunch', 'Maharashtrian Thali']),
  ('rest_03_yellow', 'Snacks Window [Sample Data]', 15, 18, ARRAY['Snacks', 'Chai']),
  ('rest_03_yellow', 'Dinner Window [Sample Data]', 18, 23, ARRAY['Dinner']),

  ('rest_04_excessive_detour', 'Lunch Window [Sample Data]', 11, 15, ARRAY['Lunch', 'Fine Heritage Dining']),
  ('rest_04_excessive_detour', 'Dinner Window [Sample Data]', 18, 22, ARRAY['Dinner']),

  ('rest_05_closed_eta', 'Dinner Window [Sample Data]', 18, 23, ARRAY['Dinner', 'Late Night', 'Barbecue']),

  ('rest_06_no_lunch', 'Breakfast Window [Sample Data]', 6, 11, ARRAY['Breakfast', 'Pancakes', 'Bakery']),
  ('rest_06_no_lunch', 'Bakery Snacks Window [Sample Data]', 11, 15, ARRAY['Bakery', 'Pancakes', 'Coffee']),

  ('rest_07_top_pick', 'Breakfast Window [Sample Data]', 0, 11, ARRAY['Breakfast', 'Specialty Coffee', 'Sandwiches']),
  ('rest_07_top_pick', 'Lunch Window [Sample Data]', 11, 16, ARRAY['Lunch', 'Coffee', 'Burgers', 'Quick Bites', 'Sandwiches']),
  ('rest_07_top_pick', 'Snacks Window [Sample Data]', 16, 19, ARRAY['Coffee', 'Quick Bites', 'Pastries']),
  ('rest_07_top_pick', 'Dinner Window [Sample Data]', 19, 24, ARRAY['Burgers', 'Quick Bites', 'Coffee']),

  ('rest_08_unverified', 'All Day Tea Window [Sample Data]', 8, 18, ARRAY['Lunch', 'Snacks', 'Tea']),

  ('rest_09_midnight', 'Lunch Window [Sample Data]', 11, 16, ARRAY['Lunch', 'Burgers']),
  ('rest_09_midnight', 'Dinner Window [Sample Data]', 18, 23, ARRAY['Dinner', 'Burgers']),
  ('rest_09_midnight', 'Late Night Window [Sample Data]', 23, 3, ARRAY['Late Night', 'Burgers']),

  ('rest_10_vegan_budget', 'Lunch Window [Sample Data]', 11, 15, ARRAY['Lunch', 'Salads', 'Bowls', 'Vegetarian']),
  ('rest_10_vegan_budget', 'Dinner Window [Sample Data]', 18, 22, ARRAY['Bowls', 'Salads', 'Vegetarian']),

  ('rest_11_seafood_luxury', 'Lunch Window [Sample Data]', 11, 15, ARRAY['Lunch', 'Seafood', 'Coastal Thali']),
  ('rest_11_seafood_luxury', 'Dinner Window [Sample Data]', 18, 23, ARRAY['Dinner', 'Seafood', 'Luxury Platter']),

  ('rest_12_quick_burgers', 'Lunch Window [Sample Data]', 11, 16, ARRAY['Lunch', 'Burgers', 'Fast Food', 'Quick Bites']),
  ('rest_12_quick_burgers', 'Dinner Window [Sample Data]', 18, 23, ARRAY['Burgers', 'Fast Food', 'Quick Bites']);

-- 6. Sample Mumbai-Pune Route (Marked as sample data)
INSERT INTO public.routes (
  id, user_id, name, origin_name, destination_name,
  total_distance_meters, total_duration_seconds, coordinates, source
) VALUES (
  'route-mumbai-pune-expressway',
  null,
  'Mumbai to Pune Expressway Corridor (NH-48) [Sample Data]',
  'Mumbai (Eastern Express Highway)',
  'Pune (Kiwale Interchange / Wakad)',
  148500,
  8400,
  '[[19.0760, 72.8777], [19.0600, 72.9980], [19.0144, 73.1025], [18.9120, 73.2050], [18.8350, 73.3080], [18.7900, 73.3400], [18.7525, 73.4086], [18.7200, 73.6500], [18.6850, 73.7200], [18.5204, 73.8567]]'::jsonb,
  'sample-demo'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  total_distance_meters = EXCLUDED.total_distance_meters,
  total_duration_seconds = EXCLUDED.total_duration_seconds,
  coordinates = EXCLUDED.coordinates;
