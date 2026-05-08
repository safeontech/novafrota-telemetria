// Schema barrel — one re-export per table file.
//
// NavorTech XVM persistence layer (Milestone 2). The data model mirrors
// the protocol decode pipeline:
//
//   inbound bytes → `packets` (raw evidence)
//                 → `frames`  (per `>…<` envelope, parsed)
//                 → `reports_*` (typed body decode, one table per opcode)
//
// `devices` is the registry, populated on first contact.

export * from "./enums";
export * from "./devices";
export * from "./packets";
export * from "./frames";
export * from "./reports";
export * from "./users";
