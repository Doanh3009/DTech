import { describe, expect, it, vi } from "vitest";
import { animatePageEntry, supportsPageViewTransitions } from "./pageEntryMotion";

describe("page entry motion", () => {
  it("respects reduced motion", () => {
    const element = document.createElement("main");
    element.animate = vi.fn();
    animatePageEntry(element, true);
    expect(element.animate).not.toHaveBeenCalled();
  });

  it("enters smoothly without remounting or clearing a form", () => {
    const element = document.createElement("main");
    const input = document.createElement("input");
    input.value = "Đơn đang soạn";
    element.append(input);
    element.animate = vi.fn();
    animatePageEntry(element);
    expect(element.animate).toHaveBeenCalledWith([
      { opacity: 0.78, transform: "translateY(6px)" },
      { opacity: 1, transform: "translateY(0)" }
    ], { duration: 240, easing: "cubic-bezier(.22,.72,.2,1)" });
    expect(element.firstChild).toBe(input);
    expect(input.value).toBe("Đơn đang soạn");
  });

  it("returns the animation so route cleanup can cancel interrupted navigation", () => {
    const element = document.createElement("main");
    const animation = { cancel: vi.fn() } as unknown as Animation;
    element.animate = vi.fn().mockReturnValue(animation);
    expect(animatePageEntry(element)).toBe(animation);
  });

  it("does not change scrolling or leave a transform on the page", () => {
    const element = document.createElement("main");
    element.scrollTop = 192;
    element.animate = vi.fn();
    animatePageEntry(element);
    expect(element.scrollTop).toBe(192);
    expect(element.style.transform).toBe("");
    expect(element.animate).toHaveBeenCalledWith(expect.any(Array), expect.not.objectContaining({ fill: "forwards" }));
  });

  it("supports browsers without the animation API", () => {
    expect(() => animatePageEntry(document.createElement("main"))).not.toThrow();
  });

  it("keeps the page usable when an embedded browser rejects the animation", () => {
    const element = document.createElement("main");
    const input = document.createElement("input");
    input.value = "Điều chỉnh đang soạn";
    element.append(input);
    element.animate = vi.fn(() => { throw new DOMException("Animation unavailable", "NotSupportedError"); });
    expect(() => animatePageEntry(element)).not.toThrow();
    expect(element.firstChild).toBe(input);
    expect(input.value).toBe("Điều chỉnh đang soạn");
    expect(element.style.transform).toBe("");
  });
});

describe("native page motion support", () => {
  it("uses the fallback when the browser cannot start view transitions", () => {
    expect(supportsPageViewTransitions(document.implementation.createHTMLDocument())).toBe(false);
  });

  it("uses the fallback for browsers missing transition classes", () => {
    const browserDocument = { startViewTransition: vi.fn(), documentElement: { style: {} } } as unknown as Document;
    expect(supportsPageViewTransitions(browserDocument)).toBe(false);
  });

  it("recognizes browsers supporting the React transition classes", () => {
    const browserDocument = document.implementation.createHTMLDocument();
    Object.defineProperty(browserDocument, "startViewTransition", { value: vi.fn() });
    Object.defineProperty(browserDocument.documentElement.style, "viewTransitionClass", { value: "" });
    expect(supportsPageViewTransitions(browserDocument)).toBe(true);
  });
});
