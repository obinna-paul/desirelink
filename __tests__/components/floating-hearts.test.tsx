import { fireEvent, render } from "@testing-library/react";

import { FloatingHeartsLayer } from "@/components/live/floating-hearts";

describe("FloatingHeartsLayer", () => {
  it("renders remote reaction bursts for a non-interactive host layer", () => {
    const { container, rerender } = render(
      <FloatingHeartsLayer remoteReactionTick={0} />,
    );

    const layer = container.firstElementChild as HTMLElement;
    expect(layer).toHaveClass("pointer-events-none");

    rerender(<FloatingHeartsLayer remoteReactionTick={1} />);
    expect(container.querySelectorAll("svg")).toHaveLength(4);
  });

  it("sends one reaction and shows one local burst on double tap", () => {
    const onDoubleTap = jest.fn();
    const { container } = render(
      <FloatingHeartsLayer onDoubleTap={onDoubleTap} remoteReactionTick={0} />,
    );
    const layer = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(layer, { clientX: 100, clientY: 200 });
    fireEvent.pointerDown(layer, { clientX: 100, clientY: 200 });

    expect(onDoubleTap).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll("svg")).toHaveLength(4);
  });
});
