import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

export const database = process.env.DATABASE_URL ? drizzle(neon(process.env.DATABASE_URL)) : undefined;
