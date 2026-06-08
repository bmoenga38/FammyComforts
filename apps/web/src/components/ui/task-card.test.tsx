import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskCard } from "./task-card";

describe("TaskCard", () => {
  it("renders the status chip, title, checklist, and action", () => {
    render(
      <TaskCard
        status="warning"
        statusLabel="In progress"
        title="Clean Room 103"
        description="Verify the bathroom kit."
        checklist={[
          { label: "Bedding changed", done: true },
          { label: "Bathroom cleaned" },
        ]}
        action={<button type="button">Mark complete</button>}
      />,
    );

    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Clean Room 103")).toBeInTheDocument();
    expect(screen.getByLabelText("Bedding changed")).toBeChecked();
    expect(screen.getByLabelText("Bathroom cleaned")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Mark complete" })).toBeInTheDocument();
  });
});
