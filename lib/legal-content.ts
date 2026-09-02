export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
};

const LAST_UPDATED = "September 1, 2026";

export const PRIVACY_POLICY: LegalDocument = {
  title: "Privacy Policy",
  lastUpdated: LAST_UPDATED,
  intro:
    "udala (“we,” “us,” “our”) operates a private, adult-only (18+) social platform for creators, providers, and members. This policy explains what personal information we collect, why we collect it, and the choices you have.",
  sections: [
    {
      heading: "1. Information we collect",
      bullets: [
        "Account & profile information: email, username, display name, bio, gender, orientation, photos, city and location, and account type (Explorer or Provider).",
        "Content you create: posts, comments, messages, live streams, service listings, and reviews.",
        "Verification information: creators and service providers submit a government ID photo and a short selfie video so we can confirm they're real adults. These are reviewed manually and deleted immediately afterward — we never use them for anything else.",
        "Payment information: subscriptions, hearts, and service bookings are processed by Paystack. We don't store your full card details ourselves.",
        "Usage & device information: pages viewed, actions taken, IP address, browser/device type, login times, and activity status (which you can hide from other users in Settings).",
        "Communications: messages you send on the platform, and anything you send our support team.",
      ],
    },
    {
      heading: "2. How we use your information",
      bullets: [
        "To provide and operate the app — your profile, messages, payments, live streams, and location-based discovery.",
        "To verify identity and age, and to prevent fraud, impersonation, and abuse.",
        "To personalize discovery and recommendations.",
        "To enforce our Terms of Use and Safety Guidelines, including reviewing reports and moderation flags.",
        "To send you notifications about activity relevant to you — most of these can be controlled in Settings.",
        "To improve and secure the platform.",
      ],
    },
    {
      heading: "3. How we share information",
      bullets: [
        "With other users, limited to what you choose to make visible — your exact location, full legal name, and verification documents are never shown to other users.",
        "With service providers who help us operate: Cloudinary (media storage), Paystack (payments), LiveKit (live audio/video infrastructure), and Pusher (real-time messaging and notifications). They only receive what they need to do their job.",
        "When required by law, or to protect the rights and safety of our users, or to investigate fraud or abuse.",
        "We do not sell your personal information.",
      ],
    },
    {
      heading: "4. Data retention",
      paragraphs: [
        "We keep your account information for as long as your account is active. Verification documents — ID photos and selfie videos — are deleted immediately after manual review, whether approved or denied.",
        "If you delete your account, we remove or anonymize your personal information within a reasonable period, except where we're required to retain records for legal or safety reasons.",
      ],
    },
    {
      heading: "5. Your choices & rights",
      bullets: [
        "Access, correct, or delete your profile information at any time from Settings.",
        "Control who can see your activity status, exact location, and other profile fields.",
        "Block or report other users.",
        "Ask us for a copy of your data, or to delete your account, through the Help Center.",
      ],
    },
    {
      heading: "6. Cookies",
      paragraphs: [
        "We use essential cookies to keep you signed in and remember your preferences. We don't use third-party advertising trackers.",
      ],
    },
    {
      heading: "7. Age requirement",
      paragraphs: [
        "udala is strictly for adults 18 years of age or older. We do not knowingly collect information from anyone under 18, and any account found to belong to a minor is removed immediately.",
      ],
    },
    {
      heading: "8. Security",
      paragraphs: [
        "We use industry-standard measures — encrypted connections, hashed passwords, and access controls — to protect your information. No system is completely secure, so please use a strong, unique password.",
      ],
    },
    {
      heading: "9. Changes to this policy",
      paragraphs: [
        "We may update this policy from time to time. We'll post the updated version here with a new “last updated” date.",
      ],
    },
    {
      heading: "10. Contact us",
      paragraphs: ["Questions about this policy? Reach us through the Help Center in the app."],
    },
  ],
};

export const TERMS_OF_USE: LegalDocument = {
  title: "Terms of Use",
  lastUpdated: LAST_UPDATED,
  intro:
    "These Terms of Use (“Terms”) govern your access to and use of udala. By creating an account or using the app, you agree to these Terms.",
  sections: [
    {
      heading: "1. Eligibility",
      paragraphs: [
        "You must be at least 18 years old to use udala. By using the app, you confirm that you meet this requirement and that adult social content may appear on the platform.",
      ],
    },
    {
      heading: "2. Your account",
      bullets: [
        "You're responsible for keeping your login credentials secure and for all activity under your account.",
        "You must provide accurate information and keep your profile up to date.",
        "Creators and service providers must complete identity verification before posting premium content or listing services.",
      ],
    },
    {
      heading: "3. Acceptable use",
      paragraphs: ["You agree not to:"],
      bullets: [
        "Harass, threaten, or abuse other users.",
        "Post or share non-consensual, exploitative, or illegal content.",
        "Impersonate another person or create a fake profile.",
        "Involve minors in any content or interaction, in any way.",
        "Request or arrange payment outside the app to circumvent our systems.",
        "Engage in scams, extortion, blackmail, or payment chargebacks.",
        "Use bots or automated tools to access the app, or attempt to bypass verification or safety features.",
      ],
    },
    {
      heading: "4. Content",
      paragraphs: [
        "You retain ownership of the content you post, but you grant udala a license to host, display, and distribute it as necessary to operate the app — for example, showing your posts to your subscribers.",
        "You're solely responsible for the content you share and must have the right to share it. We may remove content that violates these Terms or our Safety Guidelines.",
      ],
    },
    {
      heading: "5. Payments, subscriptions & hearts",
      paragraphs: [
        "Some features — subscriptions, hearts and gifting, service bookings — involve real payments processed through Paystack. Prices, subscription terms, and refund eligibility are shown at the time of purchase; hearts and gifts are generally non-refundable once sent.",
        "Providers are responsible for accurately describing their services and for fulfilling what they offer.",
      ],
    },
    {
      heading: "6. Live streaming",
      paragraphs: [
        "Live streams must follow the same conduct rules as the rest of the platform. Streamers are responsible for what happens during their stream, and we may end a stream that violates our policies.",
      ],
    },
    {
      heading: "7. Verification",
      paragraphs: [
        "Verification — a government ID and a short selfie video — confirms you're a real adult. Submitting fake documents, or someone else's, is a serious violation and will result in account suspension.",
      ],
    },
    {
      heading: "8. Termination",
      paragraphs: [
        "You may delete your account at any time. We may suspend or terminate your account if you violate these Terms, our Safety Guidelines, or applicable law.",
      ],
    },
    {
      heading: "9. Disclaimers",
      paragraphs: [
        "udala is provided “as is.” We don't guarantee that the app will always be available or error-free, or that any particular outcome — matches, bookings, earnings — will occur. We are not responsible for the conduct of other users, on or off the platform.",
      ],
    },
    {
      heading: "10. Limitation of liability",
      paragraphs: [
        "To the fullest extent permitted by law, udala is not liable for indirect, incidental, or consequential damages arising from your use of the app.",
      ],
    },
    {
      heading: "11. Changes to these Terms",
      paragraphs: [
        "We may update these Terms from time to time. Continuing to use udala after changes take effect means you accept the updated Terms.",
      ],
    },
    {
      heading: "12. Contact",
      paragraphs: ["Questions about these Terms? Reach us through the Help Center in the app."],
    },
  ],
};

export const SAFETY_GUIDELINES: LegalDocument = {
  title: "Safety Guidelines",
  lastUpdated: LAST_UPDATED,
  intro: "Your safety matters to us. These guidelines explain the tools we provide and how to use udala responsibly.",
  sections: [
    {
      heading: "Verification isn't a guarantee",
      paragraphs: [
        "We verify that creators and service providers are real adults using a government ID and a short selfie video. This helps prevent fake accounts, but it doesn't guarantee someone's intentions — always use your own judgment.",
      ],
    },
    {
      heading: "Protect your personal information",
      bullets: [
        "Avoid sharing your full legal name, home address, workplace, or financial details with people you've just met.",
        "Keep conversations on the platform, where our safety tools — blocking, reporting, moderation — apply.",
      ],
    },
    {
      heading: "Payments stay on udala",
      paragraphs: [
        "Never send money, gift cards, or cryptocurrency to another user outside of udala's built-in payment tools. Requests to pay “off-platform” are a common scam tactic and go against our Terms of Use.",
      ],
    },
    {
      heading: "Meeting in person",
      bullets: [
        "Tell a friend where you're going, meet in a public place first, and arrange your own transportation.",
        "Trust your instincts — if something feels wrong, leave.",
      ],
    },
    {
      heading: "Reporting & blocking",
      paragraphs: [
        "Every profile, post, comment, and message can be reported directly from the app. Reports go to our moderation team for review. Blocking someone immediately prevents them from contacting you or seeing your profile.",
      ],
    },
    {
      heading: "Zero tolerance",
      paragraphs: [
        "We have zero tolerance for content or behavior involving minors, non-consensual content, harassment, hate speech, scams, or violence. Accounts violating these rules are permanently removed and may be reported to law enforcement.",
      ],
    },
    {
      heading: "Getting help",
      paragraphs: [
        "If you ever feel unsafe or see something concerning, use the Report button or reach out through the Help Center. In an emergency, please contact local law enforcement.",
      ],
    },
  ],
};
