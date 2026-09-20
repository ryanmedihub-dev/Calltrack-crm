// Mirrors backend/config/features.js. NEXT_PUBLIC_ so it is readable in client components.
export const FEATURES = {
  LEAD_POOL: process.env.NEXT_PUBLIC_FEATURE_LEAD_POOL === 'true',
};
