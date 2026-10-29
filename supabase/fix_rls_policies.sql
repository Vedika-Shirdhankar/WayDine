-- =====================================================================
-- WayDine: Fix Row Level Security (RLS) Policies for Guest / Demo Mode
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/glcjizewtbnauoatdpsd/sql
-- =====================================================================

-- 1. Routes: Allow reading and inserting for both guests and authenticated users
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own routes" ON public.routes;
DROP POLICY IF EXISTS "Public routes access" ON public.routes;

CREATE POLICY "Public routes access" ON public.routes
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 2. Recommendations: Allow guest and authenticated recommendation persistence
ALTER TABLE public.pitstop_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own recommendations" ON public.pitstop_recommendations;
DROP POLICY IF EXISTS "Public recommendations access" ON public.pitstop_recommendations;

CREATE POLICY "Public recommendations access" ON public.pitstop_recommendations
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 3. Pitstop History: Allow guests and signed-in users to log selections
ALTER TABLE public.pitstop_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own pitstop history" ON public.pitstop_history;
DROP POLICY IF EXISTS "Public pitstop history access" ON public.pitstop_history;

CREATE POLICY "Public pitstop history access" ON public.pitstop_history
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
