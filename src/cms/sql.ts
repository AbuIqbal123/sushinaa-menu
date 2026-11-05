import type { Client, InStatement, Row } from "@libsql/client";

/** Owned persistence statement shape. Callers must not import @libsql/client. */
export type SqlStatement = InStatement;

/** Owned row bag returned from our database seam. */
export type DbRow = Row;

/** Owned database client surface. Prefer `db` from `./db` over constructing clients. */
export type DbClient = Client;
