import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIpFromHeaders } from "@/lib/security/request";
import { generateUniqueUsername } from "@/lib/username";
import { recordDeviceAndMaybeAlert } from "@/lib/email/device";

async function ensureProfileForAuthUser(user: {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}) {
  if (!user.id || !user.email) return;

  const existingProfile = await prisma.profile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (existingProfile) return;

  const email = user.email.toLowerCase();
  const fallbackName = email.split("@")[0] || "Udala member";
  const displayName = user.name?.trim() || fallbackName;
  const username = await generateUniqueUsername(email);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      email,
      name: displayName,
      image: user.image ?? undefined,
      // Google already verifies the email itself, so there's nothing for our own OTP
      // flow to add here - only the credentials signup path needs it.
      emailVerified: new Date(),
      profile: {
        create: {
          username,
          usernameChosen: false,
          displayName,
          bio: "",
          avatarUrl: user.image ?? "",
          gender: "unspecified",
          orientation: "unspecified",
          locationLat: 0,
          locationLng: 0,
          city: "",
          country: "",
          profileType: "EXPLORER",
        },
      },
    },
  });
}

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      identifier: { label: "Email or username", type: "text" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials, req) {
      if (!credentials?.identifier || !credentials?.password) return null;

      const identifier = credentials.identifier.trim().toLowerCase();
      const ip = getClientIpFromHeaders(req.headers);
      const loginLimit = checkRateLimit(`login:${ip}:${identifier}`, {
        limit: 10,
        windowMs: 15 * 60 * 1000,
      });
      if (!loginLimit.allowed) return null;

      const user = await prisma.user.findFirst({
        where: { OR: [{ email: identifier }, { profile: { username: identifier } }] },
      });

      if (!user || !user.passwordHash) return null;

      const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!isValid) return null;

      recordDeviceAndMaybeAlert(user.id, user.email, req.headers);

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
      authorization: {
        params: {
          scope: "openid email profile",
          // Forces Google to always show the account chooser instead of silently
          // reusing whichever Google session the browser already has active -
          // otherwise a user who picks "switch account" can end up completing the
          // flow for an account they didn't mean to.
          prompt: "select_account",
        },
      },
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
  events: {
    async createUser({ user }) {
      await ensureProfileForAuthUser(user).catch((error) => {
        console.error("[auth] failed to create profile for OAuth user", error);
      });
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        await ensureProfileForAuthUser(user).catch((error) => {
          console.error("[auth] failed to ensure Google user profile", error);
        });
      }
      return true;
    },
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
