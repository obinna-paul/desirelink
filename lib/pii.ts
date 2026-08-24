export type PiiFindingType = "email" | "phone" | "name";

export type PiiFinding = {
  type: PiiFindingType;
  label: string;
  count: number;
};

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countMatches(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

function normalizeProvidedNames(names: string[]) {
  return names
    .map((name) => name.trim())
    .filter((name) => name.split(/\s+/).length >= 2);
}

export function detectTextPii(text: string, providedNames: string[] = []): PiiFinding[] {
  const findings: PiiFinding[] = [];
  const emailCount = countMatches(text, EMAIL_PATTERN);
  const phoneCount = countMatches(text, PHONE_PATTERN);
  let nameCount = 0;

  for (const name of normalizeProvidedNames(providedNames)) {
    const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi");
    nameCount += countMatches(text, pattern);
  }

  if (emailCount > 0) {
    findings.push({ type: "email", label: "Email address", count: emailCount });
  }
  if (phoneCount > 0) {
    findings.push({ type: "phone", label: "Phone number", count: phoneCount });
  }
  if (nameCount > 0) {
    findings.push({ type: "name", label: "Full name", count: nameCount });
  }

  return findings;
}

export function hasImageMetadataSignature(bytes: ArrayBuffer) {
  const view = new Uint8Array(bytes.slice(0, 256));
  const header = Array.from(view)
    .map((byte) => String.fromCharCode(byte))
    .join("");

  return header.includes("Exif") || header.includes("xmp") || header.includes("iTXt");
}
