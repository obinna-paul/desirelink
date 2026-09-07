import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { PwaInstallPrompt } from "@/components/pwa/pwa-install-prompt";

const navigation = require("next/navigation") as {
  __setPathname: (pathname: string) => void;
};

function setDevice(
  userAgent: string,
  standalone = false,
  installedRelatedApps?: Array<{ platform: string; url?: string }>,
) {
  Object.defineProperty(navigator, "userAgent", { value: userAgent, configurable: true });
  Object.defineProperty(navigator, "platform", { value: "", configurable: true });
  Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });
  Object.defineProperty(navigator, "standalone", { value: standalone, configurable: true });
  Object.defineProperty(navigator, "getInstalledRelatedApps", {
    value: installedRelatedApps
      ? jest.fn(async () => installedRelatedApps)
      : undefined,
    configurable: true,
  });
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: standalone && query === "(display-mode: standalone)",
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

describe("PwaInstallPrompt", () => {
  beforeEach(() => {
    navigation.__setPathname("/login");
    window.__udalaInstallPrompt = null;
  });

  afterEach(() => {
    window.__udalaInstallPrompt = null;
    document.body.style.overflow = "";
  });

  it("uses the browser install prompt on Android and hides after the choice", async () => {
    setDevice("Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/140 Mobile");
    const prompt = jest.fn(async () => undefined);
    const installEvent = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted"; platform: string }>;
    };
    Object.defineProperties(installEvent, {
      prompt: { value: prompt },
      userChoice: { value: Promise.resolve({ outcome: "accepted", platform: "web" }) },
    });
    window.__udalaInstallPrompt = installEvent;

    render(<PwaInstallPrompt />);

    expect(await screen.findByText("Keep Udala close")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText("Keep Udala close")).not.toBeInTheDocument());
  });

  it("shows iPhone-specific Add to Home Screen instructions", async () => {
    setDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile");

    render(<PwaInstallPrompt />);

    expect(await screen.findByText("Add it to your Home Screen.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "How" }));
    expect(screen.getByRole("dialog", { name: "Add Udala to Home Screen" })).toBeInTheDocument();
    expect(screen.getByText("Add to Home Screen")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByText("Keep Udala close")).not.toBeInTheDocument();
  });

  it("never prompts inside the installed standalone app", () => {
    setDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile", true);

    render(<PwaInstallPrompt />);

    expect(screen.queryByText("Keep Udala close")).not.toBeInTheDocument();
  });

  it("prompts again on logged-in routes when Android reports the PWA was uninstalled", async () => {
    navigation.__setPathname("/messages");
    setDevice(
      "Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/140 Mobile",
      false,
      [],
    );

    render(<PwaInstallPrompt />);

    expect(await screen.findByText("Keep Udala close")).toBeInTheDocument();
    expect(screen.getByText("Reinstall Udala from Chrome.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "How" }));
    expect(screen.getByRole("dialog", { name: "Add Udala back to your phone" })).toBeInTheDocument();
  });

  it("does not prompt in Chrome when Android reports the PWA is installed", async () => {
    setDevice(
      "Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/140 Mobile",
      false,
      [{ platform: "webapp", url: "/manifest.json" }],
    );

    render(<PwaInstallPrompt />);

    await waitFor(() => {
      expect(
        (navigator as Navigator & { getInstalledRelatedApps: jest.Mock })
          .getInstalledRelatedApps,
      ).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("Keep Udala close")).not.toBeInTheDocument();
  });
});
