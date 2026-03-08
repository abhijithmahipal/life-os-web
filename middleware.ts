import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Matches all routes except api/auth endpoints and static next.js files
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
}
