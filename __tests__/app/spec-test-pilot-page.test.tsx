import { redirect } from "next/navigation";

import SpecTestPilotPage from "@/app/spec-test/pilot/page";

const mockRedirect = redirect as unknown as jest.Mock;

describe("retired Spec Test pilot page", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sends old pilot links into the official quiz", () => {
    SpecTestPilotPage();
    expect(mockRedirect).toHaveBeenCalledWith("/spec-test/quiz");
  });
});
