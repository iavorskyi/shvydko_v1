export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/home/:path*",
    "/exercises/:path*",
    "/library/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/parent/:path*",
    "/test/:path*",
    "/onboarding/:path*",
    "/api/user/:path*",
    "/api/sessions/:path*",
    "/api/achievements/:path*",
    "/api/goals/:path*",
    "/api/settings/:path*",
    "/api/texts/:path*",
    "/api/test-results/:path*",
    "/api/sync/:path*",
  ],
};
