---
description: "Generate realistic Firestore seed data for testing. Invoke with an entity name or collection path to generate TypeScript seed data objects matching the app's type definitions."
agent: agent
tools: [read, search]
argument-hint: "Entity name or collection path (e.g., 'clients', 'gigs with entries', 'a full week with OT')"
---

Read the relevant type definitions from `src/types/` and generate realistic seed data for testing.

Requirements:

- Output TypeScript objects that satisfy the type definitions exactly (no missing required fields)
- Use realistic freelance work values (real-sounding client names, positions like "A1", "Stage Manager", "LD", rates in the $35–$85/hr range)
- Generate at least 3 variants: a simple/minimal case, a typical case, and a complex/edge case
- For pay-related data, include at least one case that triggers overtime and one that includes a meal penalty
- Wrap in a `const seedData = { ... }` export so it can be imported in test files
- Add a comment above each object explaining what scenario it represents

Output the seed data as a TypeScript file ready to save to `src/__fixtures__/<entity>.fixtures.ts`.
