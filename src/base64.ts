// btoa and atob only handle one byte per character, so these go through UTF-8.

export function encodeBase64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(binary);
}

/** Decodes base64, ignoring line breaks and other whitespace in it. */
export function decodeBase64(base64: string) {
  const binary = atob(base64.replace(/\s/g, ""));
  return new TextDecoder().decode(
    Uint8Array.from(binary, (char) => char.charCodeAt(0)),
  );
}
