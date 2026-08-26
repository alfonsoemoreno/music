import { createHash, randomInt } from "node:crypto";

export const hashEnrollmentCode = (code: string): string => createHash("sha256").update(code).digest("hex");

/** A human-friendly, short-lived pairing PIN. It is stored server-side only as a hash. */
export const createEnrollmentCode = (): string => randomInt(0, 1_000_000).toString().padStart(6, "0");
