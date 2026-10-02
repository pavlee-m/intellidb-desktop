#!/usr/bin/env node
// Query the IntelliDB config DB of the verification scratch home.
//   node db-query.mjs "SELECT ID, Name FROM Connection;"
//   node db-query.mjs --real-home "SELECT ..."   (user's real DB — SELECT only)
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const sqlite3 = require(path.join(process.cwd(), 'node_modules', 'sqlite3'));

const args = process.argv.slice(2);
const useRealHome = args[0] === '--real-home';
const sql = args[useRealHome ? 1 : 0];
if (!sql) {
  console.error('usage: db-query.mjs [--real-home] "<sql>"');
  process.exit(2);
}
if (useRealHome && !/^\s*SELECT/i.test(sql)) {
  console.error('db-query: only SELECT statements are allowed against the real home DB');
  process.exit(2);
}

const dbPath = path.join(useRealHome ? os.homedir() : '/tmp/intellidb-verify-home', '.intellidb', 'config.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error(`db-query: cannot open ${dbPath}: ${err.message}`);
    process.exit(1);
  }
});
db.all(sql, (err, rows) => {
  if (err) {
    console.error(`db-query: ${err.message}`);
    process.exit(1);
  }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
