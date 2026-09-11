import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AccountTypeStep } from "@/components/auth/account-type-step";

describe("AccountTypeStep", () => {
  it("offers Explorer, Seeker, and Creator as the three account types", () => {
    render(<AccountTypeStep value="EXPLORER" onChange={jest.fn()} />);

    expect(screen.getByRole("radio", { name: /Explorer/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Seeker/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Creator/ })).toBeInTheDocument();
  });

  it("marks the current value as checked", () => {
    render(<AccountTypeStep value="SEEKER" onChange={jest.fn()} />);

    expect(screen.getByRole("radio", { name: /Seeker/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /Explorer/ })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange with SEEKER when the Seeker card is picked", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<AccountTypeStep value="EXPLORER" onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: /Seeker/ }));

    expect(onChange).toHaveBeenCalledWith("SEEKER");
  });
});
