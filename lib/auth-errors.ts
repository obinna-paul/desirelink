/**
 * Maps NextAuth's `?error=` query codes to user-facing copy. Without this, a failed sign-in
 * redirects back to /login with the reason baked into the URL but nothing shown on screen -
 * if the user still has a valid session for another account (never explicitly signed out),
 * the failure looks exactly like "it ignored what I picked and kept me on my old account."
 */
export function getAuthErrorMessage(code: string | null): string | null {
  if (!code) return null;

  switch (code) {
    case "OAuthAccountNotLinked":
      return "That email is already registered on udala. Log in with your email and password instead, or continue with a different Google account.";
    case "OAuthSignin":
    case "OAuthCallback":
    case "OAuthCreateAccount":
    case "Callback":
      return "We couldn't complete sign-in with Google. Please try again.";
    case "CredentialsSignin":
      return "Invalid email/username or password";
    case "AccessDenied":
      return "Access was denied. Please try again.";
    case "SessionRequired":
      return "Please sign in to continue.";
    default:
      return "Something went wrong signing you in. Please try again.";
  }
}
