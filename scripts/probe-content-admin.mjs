import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import { adminEntityDefinitions } from '../src/lib/content-admin-entities.mjs';

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvFile('.env.local');
loadEnvFile('.env');

function requiredEnv(name) { const value = process.env[name]?.trim(); if (!value) throw new Error(name + ' is not configured.'); return value; }
function sanitize(value) { return String(value ?? '').replace(/(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g, '[redacted-token]').slice(0, 240); }

for (const [entity, definition] of Object.entries(adminEntityDefinitions)) {
  if (definition.table.includes(',') || /[()]/.test(definition.table)) throw new Error(`Invalid table name for ${entity}: ${definition.table}`);
  if (definition.trash && (!definition.select.split(',').includes('deleted_at') || !definition.select.split(',').includes('deleted_by'))) throw new Error(`Trash columns missing from ${entity} select`);
}

const supabase = createClient(requiredEnv('NEXT_PUBLIC_SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
let failed = 0;
for (const [entity, definition] of Object.entries(adminEntityDefinitions)) {
  let query = supabase.from(definition.table).select(definition.select, { count: 'exact' }).limit(25);
  if (definition.trash) query = query.is('deleted_at', null);
  const result = await query;
  if (result.error) failed += 1;
  const rowCount = result.error ? null : result.count ?? result.data?.length ?? 0;
  if ((entity === 'categories' || entity === 'tags') && rowCount === 0) { console.error(`Expected seeded ${entity} records.`); failed += 1; }
  console.log(JSON.stringify({ probe: `Production loader ${entity}`, ok: !result.error, code: result.error?.code ?? null, message: sanitize(result.error?.message), rowCount }));
}
if (failed > 0) process.exit(1);
