gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

// Initializes smooth scrolling with GSAP ScrollSmoother.
ScrollSmoother.create({
  smooth: 1,
  effects: true,
  normalizeScroll: true,
});
