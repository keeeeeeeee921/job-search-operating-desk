export const DEMO_READ_ONLY_MESSAGE =
  "This deployment is a read-only public demo. Records, stages, comments, and goals cannot be changed.";

/**
 * JOB_DESK_PUBLIC_DEMO=true turns the app into a read-only showcase: data is
 * served from the bundled seed set (lib/seed.ts) and every write path is
 * refused. Read in the middleware, the data layer, server actions, API routes,
 * and the root layout (which passes it to client components).
 */
type DemoEnv = { JOB_DESK_PUBLIC_DEMO?: string };

export function isPublicDemoMode(env: DemoEnv = process.env as DemoEnv) {
  return env.JOB_DESK_PUBLIC_DEMO === "true";
}
