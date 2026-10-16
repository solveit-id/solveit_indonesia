import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusCapsule } from "./status-capsule";
import { TextField } from "./text-field";

describe("TextField", () => {
  it("wires label, hint, and error to the input", () => {
    render(<TextField label="Alamat email" hint="Petunjuk." error="Salah." />);

    const input = screen.getByLabelText("Alamat email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Petunjuk. Salah.");
    expect(screen.getByRole("alert")).toHaveTextContent("Salah.");
  });

  it("is not invalid without an error", () => {
    render(<TextField label="Nama" />);

    expect(screen.getByLabelText("Nama")).not.toHaveAttribute("aria-invalid");
  });
});

describe("StatusCapsule", () => {
  it("writes the status out; the glyph is decorative", () => {
    const { container } = render(<StatusCapsule status="planned" label="Direncanakan" />);

    expect(screen.getByText("Direncanakan")).toBeInTheDocument();
    expect(container.querySelector(".phase-glyph")).toHaveAttribute("aria-hidden", "true");
  });
});
