/**
 * Cursor Encoding / Decoding
 *
 * A cursor encodes the position of the LAST item on the current page.
 * The next page query asks: "give me items that come AFTER this position".
 *
 * Why Base64?
 * — Opaque to the client (they shouldn't parse it)
 * — URL-safe when using base64url
 * — Encodes any JSON payload (composite keys, timestamps, etc.)
 *
 * Our cursor payload: { updatedAt: ISO string, id: UUID }
 * These two fields uniquely identify a position in our sorted result set.
 */

/**
 * Encode a cursor from pagination fields.
 * @param {Date|string} updatedAt
 * @param {string} id  — UUID
 * @returns {string} base64-encoded cursor string
 */
function encodeCursor(updatedAt, id) {
  const payload = {
    updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt,
    id,
  };
  // JSON → UTF-8 → Base64
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

/**
 * Decode a cursor back into { updatedAt: Date, id: string }.
 * Returns null if the cursor is missing or malformed.
 * @param {string|undefined} cursor
 * @returns {{ updatedAt: Date, id: string } | null}
 */
function decodeCursor(cursor) {
  if (!cursor) return null;

  try {
    const json = Buffer.from(cursor, "base64").toString("utf8");
    const { updatedAt, id } = JSON.parse(json);

    if (!updatedAt || !id) return null;

    const date = new Date(updatedAt);
    // Guard against invalid dates (NaN)
    if (isNaN(date.getTime())) return null;

    return { updatedAt: date, id };
  } catch {
    // Malformed base64 or JSON — treat as no cursor (client error handled upstream)
    return null;
  }
}

module.exports = { encodeCursor, decodeCursor };
