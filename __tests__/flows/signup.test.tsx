import { rest } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SignupPage from "@/app/signup/page";
import { server } from "@/test/msw/server";

const mockSignIn = jest.fn();
const navigation = jest.requireMock("next/navigation") as {
  __mockRouter: { push: jest.Mock; refresh: jest.Mock };
};

jest.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  getProviders: jest.fn().mockResolvedValue(null),
}));

describe("signup flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignIn.mockResolvedValue({ ok: true });
  });

  it("creates an account, signs in, and routes to profile setup", async () => {
    const submittedBodies: unknown[] = [];
    server.use(
      rest.post("http://localhost/api/signup", async (req, res, ctx) => {
        submittedBodies.push(await req.json());
        return res(ctx.status(201), ctx.json({ success: true }));
      })
    );

    const user = userEvent.setup();
    render(<SignupPage />);

    await user.type(screen.getByLabelText(/^name$/i), "Ada Lovelace");
    await user.type(screen.getByLabelText(/^username$/i), "adalovelace");
    await user.type(screen.getByLabelText(/email/i), "Ada@Example.COM");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "password123");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("credentials", {
        identifier: "ada@example.com",
        password: "password123",
        redirect: false,
      });
    });

    expect(submittedBodies[0]).toMatchObject({
      name: "Ada Lovelace",
      username: "adalovelace",
      email: "ada@example.com",
      profileType: "EXPLORER",
    });
    expect(navigation.__mockRouter.push).toHaveBeenCalledWith("/profile/edit");
    expect(navigation.__mockRouter.refresh).toHaveBeenCalled();
  });
});
