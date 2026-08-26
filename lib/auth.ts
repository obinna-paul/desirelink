import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIpFromHeaders } from "@/lib/security/request";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials, req) {
      if (!credentials?.email || !credentials?.password) return null;

      const email = credentials.email.toLowerCase();
      const ip = getClientIpFromHeaders(req.headers);
      const loginLimit = checkRateLimit(`login:${ip}:${email}`, {
        limit: 10,
        windowMs: 15 * 60 * 1000,
      });
      if (!loginLimit.allowed) return null;

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || !user.passwordHash) return null;

      const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!isValid) return null;

      return { id: user.id, email: user.email, name: user.name, image: user.image };
    },
  }),
];

const hasGoogleCredentials = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

if (hasGoogleCredentials) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.id;
      return session;
    },
  },
};
