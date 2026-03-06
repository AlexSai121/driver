---
name: performance
description: Strict optimization rules for lightning-fast, highly responsive web apps across all devices.
---

# Performance & Optimization Directives

## 1. Asset & Resource Management
- **Media:** Always compress and serve images/videos in modern formats (WebP, AVIF, MP4). Implement lazy loading for all below-the-fold media.
- **Delivery:** Minify CSS/JS. Use code-splitting and dynamic imports to reduce initial bundle size. 

## 2. Rendering & State 
- **Efficiency:** Minimize UI re-renders. Memoize expensive calculations and components where appropriate.
- **Animations:** Offload heavy morph animations and glassy effects (from `design_skill`) to the GPU using `transform` and `opacity` rather than animating layout properties (like `width` or `margin`).

## 3. Responsive & Device Parity
- **Mobile-First:** Code for mobile screens first, then scale up to tablet and desktop. Ensure touch targets are adequately sized.
- **Accessibility:** Ensure the site remains fast and usable on lower-end devices and throttled network connections.