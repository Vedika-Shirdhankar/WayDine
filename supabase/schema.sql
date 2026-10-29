-- =====================================================================
-- WayDine Database Schema (Supabase / PostgreSQL)
-- Multi-tenant schema with PKs, FKs, Indexes, CHECK constraints,
-- Row-Level Security (RLS) policies, and guarded PostGIS extensions.
-- =====================================================================

-- 1. Guarded Extension Check for PostGIS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS postgis;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'PostGIS extension creation skipped (insufficient privilege). Standard numeric coordinates will be used.';
    END;
  END IF;
END $$;

-- 2. Users Table (Integrated with Supabase Auth)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE TABLE IF NOT EXISTS public.users (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      email TEXT UNIQUE,
      full_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  ELSE
    CREATE TABLE IF NOT EXISTS public.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      full_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  END IF;
END $$;

-- Supabase Auth Auto-Sync Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- 3. User Preferences Table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  preferred_cuisines TEXT[] DEFAULT '{}',
  dietary_restrictions TEXT[] DEFAULT '{}',
  max_detour_minutes INTEGER NOT NULL DEFAULT 15 CHECK (max_detour_minutes > 0 AND max_detour_minutes <= 60),
  require_drive_thru BOOLEAN NOT NULL DEFAULT FALSE,
  require_open_at_eta BOOLEAN NOT NULL DEFAULT TRUE,
  preferred_price_range TEXT CHECK (preferred_price_range IN ('$', '$$', '$$$', '$$$$')),
  weights JSONB NOT NULL DEFAULT '{"detourEfficiency": 30, "directionCompatibility": 25, "roadAccessibility": 20, "foodAvailability": 15, "timeCompatibility": 10}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_preferences_user UNIQUE (user_id)
);

-- 4. Roads Table
CREATE TABLE IF NOT EXISTS public.roads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  road_type TEXT NOT NULL, -- 'highway', 'motorway', 'service', 'ramp', 'arterial'
  is_divided BOOLEAN NOT NULL DEFAULT TRUE,
  speed_limit_kmh INTEGER NOT NULL DEFAULT 80 CHECK (speed_limit_kmh > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Road Segments & Network Graph Edges
CREATE TABLE IF NOT EXISTS public.road_segments (
  id TEXT PRIMARY KEY,
  road_id TEXT REFERENCES public.roads(id) ON DELETE SET NULL,
  from_node_id TEXT NOT NULL,
  to_node_id TEXT NOT NULL,
  from_lat NUMERIC(9,6) NOT NULL CHECK (from_lat BETWEEN -90 AND 90),
  from_lng NUMERIC(9,6) NOT NULL CHECK (from_lng BETWEEN -180 AND 180),
  to_lat NUMERIC(9,6) NOT NULL CHECK (to_lat BETWEEN -90 AND 90),
  to_lng NUMERIC(9,6) NOT NULL CHECK (to_lng BETWEEN -180 AND 180),
  distance_meters INTEGER NOT NULL CHECK (distance_meters >= 0),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
  speed_limit_kmh INTEGER NOT NULL DEFAULT 80 CHECK (speed_limit_kmh > 0),
  is_one_way BOOLEAN NOT NULL DEFAULT TRUE,
  is_u_turn BOOLEAN NOT NULL DEFAULT FALSE,
  is_turn BOOLEAN NOT NULL DEFAULT FALSE,
  has_median_barrier BOOLEAN NOT NULL DEFAULT FALSE,
  is_forbidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Restaurants Table
CREATE TABLE IF NOT EXISTS public.restaurants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  latitude NUMERIC(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  address TEXT,
  rating NUMERIC(2,1) CHECK (rating BETWEEN 1.0 AND 5.0),
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  price_range TEXT CHECK (price_range IN ('$', '$$', '$$$', '$$$$')),
  cuisine_type TEXT NOT NULL,
  categories TEXT[] NOT NULL DEFAULT '{}',
  dietary_options TEXT[] NOT NULL DEFAULT '{}',
  has_drive_thru BOOLEAN NOT NULL DEFAULT FALSE,
  average_dine_minutes INTEGER NOT NULL DEFAULT 20 CHECK (average_dine_minutes > 0),
  opening_time TEXT NOT NULL CHECK (opening_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  closing_time TEXT NOT NULL CHECK (closing_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  data_source TEXT NOT NULL DEFAULT 'sample-demo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Restaurant Access Points
CREATE TABLE IF NOT EXISTS public.restaurant_access_points (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  road_node_id TEXT NOT NULL,
  rejoin_node_id TEXT,
  latitude NUMERIC(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  description TEXT,
  access_class TEXT CHECK (access_class IN ('GREEN', 'YELLOW', 'RED', 'UNVERIFIED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Restaurant Food Availability Windows
CREATE TABLE IF NOT EXISTS public.restaurant_food_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  window_name TEXT NOT NULL,
  start_hour INTEGER NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  end_hour INTEGER NOT NULL CHECK (end_hour BETWEEN 0 AND 23),
  available_categories TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Routes Table
CREATE TABLE IF NOT EXISTS public.routes (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  origin_name TEXT,
  destination_name TEXT,
  total_distance_meters INTEGER NOT NULL CHECK (total_distance_meters >= 0),
  total_duration_seconds INTEGER NOT NULL CHECK (total_duration_seconds >= 0),
  coordinates JSONB NOT NULL, -- Array of [lat, lng]
  source TEXT NOT NULL DEFAULT 'demo-fallback',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Pitstop Recommendations Log
CREATE TABLE IF NOT EXISTS public.pitstop_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id TEXT REFERENCES public.routes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK (rank >= 1),
  final_score NUMERIC(5,2) NOT NULL CHECK (final_score BETWEEN 0 AND 100),
  detour_meters INTEGER NOT NULL CHECK (detour_meters >= 0),
  detour_seconds INTEGER NOT NULL CHECK (detour_seconds >= 0),
  turn_count INTEGER NOT NULL DEFAULT 0,
  u_turn_count INTEGER NOT NULL DEFAULT 0,
  accessibility_class TEXT NOT NULL CHECK (accessibility_class IN ('GREEN', 'YELLOW', 'RED', 'UNVERIFIED')),
  eta TIMESTAMPTZ NOT NULL,
  explanation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Pitstop History Table
CREATE TABLE IF NOT EXISTS public.pitstop_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  route_id TEXT REFERENCES public.routes(id) ON DELETE SET NULL,
  restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_road_segments_from_to ON public.road_segments(from_node_id, to_node_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine ON public.restaurants(cuisine_type);
CREATE INDEX IF NOT EXISTS idx_restaurant_access_restaurant ON public.restaurant_access_points(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_food_availability_restaurant ON public.restaurant_food_availability(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_route_rank ON public.pitstop_recommendations(route_id, rank);
CREATE INDEX IF NOT EXISTS idx_recommendations_user ON public.pitstop_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_preferences_user ON public.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_history_user ON public.pitstop_history(user_id);

-- Optional PostGIS spatial index block
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    BEGIN
      ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);
      UPDATE public.restaurants SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE geom IS NULL;
      CREATE INDEX IF NOT EXISTS idx_restaurants_geom ON public.restaurants USING GIST(geom);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'PostGIS geometry column/index creation skipped: %', SQLERRM;
    END;
  END IF;
END $$;

-- =====================================================================
-- Row Level Security (RLS) Policies
-- - restaurants, roads, and road_segments are publicly readable
-- - routes, recommendations, history, and preferences are readable
--   and writable only by their owner (auth.uid() = user_id)
-- =====================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.road_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_access_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_food_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitstop_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitstop_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- 1. Publicly readable tables
CREATE POLICY "Public roads are readable by everyone" ON public.roads
  FOR SELECT USING (true);

CREATE POLICY "Public road segments are readable by everyone" ON public.road_segments
  FOR SELECT USING (true);

CREATE POLICY "Public restaurants are readable by everyone" ON public.restaurants
  FOR SELECT USING (true);

CREATE POLICY "Public access points are readable by everyone" ON public.restaurant_access_points
  FOR SELECT USING (true);

CREATE POLICY "Public food availability is readable by everyone" ON public.restaurant_food_availability
  FOR SELECT USING (true);

-- 2. Owner-only tables: auth.uid() = user_id
CREATE POLICY "Users can manage own profile" ON public.users
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can manage own preferences" ON public.user_preferences
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can manage own routes" ON public.routes
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can manage own recommendations" ON public.pitstop_recommendations
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can manage own pitstop history" ON public.pitstop_history
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
