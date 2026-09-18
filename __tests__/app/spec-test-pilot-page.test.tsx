import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";

jest.mock("@/components/layout/public-header", () => ({ PublicHeader: () => null }));
jest.mock("@/components/layout/public-footer", () => ({ PublicFooter: () => null }));
jest.mock("@/components/spec-test/age-badge", () => ({ AgeBadge: () => null }));
jest.mock("@/components/spec-test/pilot/pilot-flow", () => ({
  SpecTestPilotFlow: () => <div data-testid="pilot-flow" />,
}));
jest.mock("@/lib/spec-test/pilot-v3-feature", () => ({ isV3PilotEnabled: jest.fn() }));

import SpecTestPilotPage, { metadata } from "@/app/spec-test/pilot/page";
import { isV3PilotEnabled } from "@/lib/spec-test/pilot-v3-feature";

const mockEnabled = isV3PilotEnabled as jest.Mock;
const mockNotFound = notFound as unknown as jest.Mock;

describe("Spec Test v3 pilot page", () => {
  beforeEach(() => jest.clearAllMocks());

  it("is excluded from search indexing", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("is unavailable unless the server-side pilot flag is enabled", () => {
    mockEnabled.mockReturnValue(false);
    SpecTestPilotPage();
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it("renders the isolated pilot flow when enabled", () => {
    mockEnabled.mockReturnValue(true);
    render(<SpecTestPilotPage />);
    expect(screen.getByTestId("pilot-flow")).toBeInTheDocument();
  });
});
