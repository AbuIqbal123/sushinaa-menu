# Coding principles

These apply to every change in this repository: APIs, apps, and shared code.

## DRY

Do not repeat the same rule, shape, or decision in two places. One owner. Callers reuse it.

## Orthogonal, modular code

Write small, self-contained modules. Prefer loose coupling: modular, component-based, layered. A module does one job and exposes a narrow surface.

## Layers of abstraction

Design in layers. Each layer uses only the abstractions provided by the layers below it. A higher layer must not reach past its neighbour into internals further down.

## Change blast radius

Before you add or change a function, ask: if the requirements behind this change dramatically, how many modules are affected? Prefer a design where the answer is one, or a few at the same layer—not a fan-out across the system.

## Do not rely on what you cannot control

Do not depend on undocumented behaviour, incidental properties of a library, platform quirks, or another team's internals. Depend on contracts you own or that the vendor formally guarantees.

## Shy code

Modules must not reveal anything unnecessary to other modules, and must not rely on other modules' implementations. Talk through public interfaces only.

## Testability as a coupling check

What does it take to get a unit test to build and run for this module? If you must import a large share of the rest of the system, the module is not loosely coupled. Fix the boundary; do not paper over it in the test.

## Third-party vendors behind our abstractions

Treat vendor SDKs and third-party APIs as replaceable. Hide them behind our own abstraction layers. Abstract persistence vendors so callers see persistence as a service we own, not a product-specific client.

## Flexibility where it matters

Keep flexibility in architecture, deployment, and vendor integration. Those are the seams that change. Do not scatter vendor or deploy detail through business modules.
