import { render, screen } from "@testing-library/react";

jest.mock("@/components/layout/public-header", () => ({ PublicHeader: () => null }));
jest.mock("@/components/spec-test/age-badge", () => ({ AgeBadge: () => null }));

import SpecTestLandingPage, { metadata } from "@/app/spec-test/page";

describe("Spec Test landing page", () => {
  it("keeps the page title bare, letting the root layout's template append the site name once", () => {
    // The root layout's metadata template is "%s | Udala" - if this title already included
    // "| Udala" itself, the rendered title would double up to "The Spec Test | Udala | Udala".
    expect(metadata.title).toBe("The Spec Test");
  });

  it("matches the JSON-LD WebPage name to the actual rendered <title>, not the bare page title", () => {
    const { container } = render(<SpecTestLandingPage />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const jsonLd = JSON.parse(script!.innerHTML) as { name: string };
    expect(jsonLd.name).toBe("The Spec Test | Udala");
  });

  it("advertises the official 28-question test", () => {
    render(<SpecTestLandingPage />);
    expect(screen.getByText(/answer 28 carefully designed questions/i)).toBeInTheDocument();
  });
});
