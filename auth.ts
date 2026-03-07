import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
    })
  ],
  callbacks: {
    async signIn({ user }) {
      // ONLY allow the user's specific email address
      const allowedEmail = process.env.ALLOWED_EMAIL;
      
      if (!allowedEmail) {
        console.error("ALLOWED_EMAIL is not set in environment variables!");
        return false; 
      }

      if (user.email === allowedEmail) {
        return true;
      } else {
        console.warn(`Unauthorized login attempt from: ${user.email}`);
        return false;
      }
    },
  },
})
