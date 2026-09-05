import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider, { type GoogleProfile } from "next-auth/providers/google";
import TwitterProvider, { type TwitterProfile } from "next-auth/providers/twitter";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIpFromHeaders } from "@/lib/security/request";
import { generateUniqueUsername, isUsernameAvailable } from "@/lib/username";
import { usernameFieldSchema } from "@/lib/validations/auth";
import { recordDeviceAndMaybeAlert } from "@/lib/email/device";
import { isPlaceholderEmail, placeholderEmailFor } from "@/lib/oauth-placeholder-email";

/** Every OAuth provider registered below - the signIn callback's belt-and-suspenders
 * profile-creation check (see createUser event) needs to recognize all of them. */
const OAUTH_PROVIDER_IDS = new Set(["google", "twitter"]);

/** Google's photo URLs end in a size hint like "=s96-c" - bump it up so the imported
 * avatar isn't a tiny thumbnail. Left untouched if the URL doesn't match that shape. */
function upgradeGooglePhotoUrl(url: string): string {
  return url.replace(/=s\d+(-c)?$/, "=s400-c");
}

/** X's profile_image_url is the small "_normal" thumbnail by default - stripping that
 * suffix is the documented way to get the original, full-size image back. */
function upgradeTwitterAvatarUrl(url: string): string {
  return url.replace(/_normal(\.(?:jpe?g|png|gif))$/i, "$1");
}

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
  const placeholder = isPlaceholderEmail(email);
  const fallbackName = email.split("@")[0] || "Udala member";
  const displayName = user.name?.trim() || fallbackName;
  const username = await generateUniqueUsername(email);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      email,
      name: displayName,
      image: user.image ?? undefined,
      // Google already verifies the email itself, so there's nothing for our own OTP flow
      // to add here. X never provides one at all (see lib/oauth-placeholder-email.ts) - its
      // placeholder stays unverified until /onboarding/email confirms a real address.
      emailVerified: placeholder ? null : new Date(),
      profile: {
        create: {
          username,
          usernameChosen: false,
          emailChosen: !placeholder,
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

/**
 * Adopts a brand-new X sign-up's real bio and handle onto the Profile that
 * ensureProfileForAuthUser just created with placeholder values (bio: "", a username
 * derived from the meaningless placeholder email) - only the jwt callback gets both a
 * real Profile row (via createUser, which already ran by this point) and the raw
 * provider profile at the same time, so this runs from there, gated to fire once per
 * signup rather than on every subsequent login.
 */
async function enrichTwitterSignup(userId: string, twitterProfile: TwitterProfile): Promise<void> {
  const bio = twitterProfile.data.description?.trim().slice(0, 500);

  let username: string | undefined;
  const handle = twitterProfile.data.username?.toLowerCase();
  if (handle && usernameFieldSchema.safeParse(handle).success && (await isUsernameAvailable(handle))) {
    username = handle;
  }

  if (!bio && !username) return;

  await prisma.profile.update({
    where: { userId },
    data: { ...(bio ? { bio } : {}), ...(username ? { username } : {}) },
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
    GoogleProvider<GoogleProfile>({
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
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture ? upgradeGooglePhotoUrl(profile.picture) : profile.picture,
        };
      },
    })
  );
}

const hasTwitterCredentials = Boolean(
  process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET
);

if (hasTwitterCredentials) {
  providers.push(
    TwitterProvider<TwitterProfile>({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0",
      userinfo: {
        url: "https://api.twitter.com/2/users/me",
        // Adds description (their bio) to the built-in provider's default
        // profile_image_url request - see the jwt callback's signUp branch below,
        // which is where the bio actually gets saved (this profile() callback's return
        // value only feeds User's own columns, none of which is a bio).
        params: { "user.fields": "profile_image_url,description" },
      },
      // X's API never returns an email address for any app, at any access tier - the
      // built-in provider's own default profile() hardcodes email: null, which would
      // fail outright against User.email's required/unique column. A placeholder here
      // keeps account creation working; ensureProfileForAuthUser and Profile.emailChosen
      // handle sending the user to /onboarding/email to confirm a real one afterward.
      profile(profile) {
        return {
          id: profile.data.id,
          name: profile.data.name,
          email: placeholderEmailFor(profile.data.id),
          image: profile.data.profile_image_url ? upgradeTwitterAvatarUrl(profile.data.profile_image_url) : null,
        };
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
      if (account && OAUTH_PROVIDER_IDS.has(account.provider)) {
        await ensureProfileForAuthUser(user).catch((error) => {
          console.error(`[auth] failed to ensure ${account.provider} user profile`, error);
        });
      }
      return true;
    },
    async jwt({ token, user, account, profile, trigger }) {
      if (user) token.id = user.id;
      if (trigger === "update" && token.id) {
        // Lets /onboarding/email's useSession().update() pick up a just-confirmed real
        // email into this session's JWT immediately, without requiring a fresh login.
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { email: true },
        });
        if (fresh) token.email = fresh.email;
      }
      if (trigger === "signUp" && account?.provider === "twitter" && profile && token.id) {
        await enrichTwitterSignup(token.id as string, profile as unknown as TwitterProfile).catch((error) => {
          console.error("[auth] failed to enrich Twitter signup", error);
        });
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.id;
      return session;
    },
  },
};
