import { getClientSessionId } from "@/lib/client-session";

describe("getClientSessionId", () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("generates and persists an id on first call", () => {
    const first = getClientSessionId();
    expect(first).toHaveLength(36);
    expect(window.sessionStorage.getItem("udala_session_id")).toBe(first);
  });

  it("returns the same id on subsequent calls", () => {
    const first = getClientSessionId();
    const second = getClientSessionId();
    expect(second).toBe(first);
  });

  it("degrades to an empty string when sessionStorage throws", () => {
    const spy = jest.spyOn(window.sessionStorage.__proto__, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    expect(getClientSessionId()).toBe("");

    spy.mockRestore();
  });
});
