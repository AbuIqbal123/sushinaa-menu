import type { SqlStatement } from '@/cms/sql';

/** Run an insert only when the previous statement in the batch changed one row. */
export function afterChange(statement: SqlStatement): SqlStatement {
  if (typeof statement === 'string') throw new Error('Expected a parameterized audit insert');
  return { ...statement, sql: statement.sql.replace('VALUES (?,?,?,?,?,?,?,?,?)', 'SELECT ?,?,?,?,?,?,?,?,? WHERE changes()=1') };
}
