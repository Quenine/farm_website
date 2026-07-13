export type SerializableAdminValue = string | number | boolean | null | SerializableAdminValue[] | { [key: string]: SerializableAdminValue };
export type SerializableAdminRecord = { [key: string]: SerializableAdminValue };

function isPlainObject(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function toSerializableAdminValue(value: unknown, path = "value"): SerializableAdminValue {
  if (value === undefined) return null;
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item, index) => toSerializableAdminValue(item, path + "[" + index + "]"));
  if (typeof value === "function" || value instanceof Error || value instanceof Map || value instanceof Set || value instanceof URL) {
    throw new Error("Non-serializable admin payload at " + path + ": " + Object.prototype.toString.call(value));
  }
  if (isPlainObject(value)) {
    const output: SerializableAdminRecord = {};
    for (const [key, child] of Object.entries(value)) output[key] = toSerializableAdminValue(child, path + "." + key);
    return output;
  }
  throw new Error("Non-serializable admin payload at " + path + ": " + Object.prototype.toString.call(value));
}

export function serializeAdminRecord(record: Record<string, unknown>): SerializableAdminRecord {
  return toSerializableAdminValue(record, "record") as SerializableAdminRecord;
}

export function assertSerializableAdminPayload(value: unknown, path = "payload") {
  toSerializableAdminValue(value, path);
}
