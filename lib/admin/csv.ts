/** Minimal CSV serialization for admin export endpoints - quotes any value containing a
 * comma, quote, or newline, doubling internal quotes per RFC 4180. */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (value: string | number) => {
    const str = String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))];
  return lines.join("\n");
}
