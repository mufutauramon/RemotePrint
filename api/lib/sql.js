
import sql from "mssql";

let pool;
export function getSql() { return sql; }

export async function getPool() {
  if (pool && pool.connected) return pool;
  const cs = process.env.SQL_CONNECTION_STRING;
  if (!cs) throw new Error("SQL_CONNECTION_STRING missing");
  pool = await sql.connect(cs);
  return pool;
}
