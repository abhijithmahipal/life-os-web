export { auth as middleware } from "./auth"

export const config = {
  // Matches all routes except api/auth endpoints and static next.js files
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
}
