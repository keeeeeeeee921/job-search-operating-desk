import type { MetadataRoute } from "next";

/**
 * This is a private desk (or, in demo mode, a showcase of seed data); it must
 * never be indexed. Served at /robots.txt, which the middleware keeps public.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/"
    }
  };
}
