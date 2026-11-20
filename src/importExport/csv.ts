import { toAlbum } from "../albums/albumFiles";
import { FORMAT_LABELS } from "../albums/albumFormats";
import { Album } from "../types";

const HEADER = [
  "Title",
  "Artist",
  "Year",
  "Format",
  "Status",
  "Cover URL",
  "Notes",
];

const STATUS_LABELS: Record<Album["status"], string> = {
  owned: "Owned",
  wishlisted: "Wishlisted",
};

type Column =
  "title" | "artist" | "year" | "format" | "status" | "coverUrl" | "notes";

// Header names are compared as lowercase letters only, so "Cover URL",
// "cover_url" and "coverUrl" all match. Discogs exports call the year
// "Released" and the notes "Collection Notes".
const COLUMNS: Record<string, Column> = {
  title: "title",
  album: "title",
  artist: "artist",
  year: "year",
  released: "year",
  format: "format",
  media: "format",
  mediatype: "format",
  medium: "format",
  status: "status",
  coverurl: "coverUrl",
  coverimageurl: "coverUrl",
  cover: "coverUrl",
  notes: "notes",
  note: "notes",
  collectionnotes: "notes",
};

// Spreadsheets run cells that start with these as formulas, so the export
// puts an apostrophe in front, which they show as plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

export class InvalidCsvError extends Error {
  constructor() {
    super("That CSV file needs Title and Artist columns.");
  }
}

function toCell(value: string) {
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The collection as a CSV file, for spreadsheets. */
export function createCsv(albums: Album[]) {
  const rows = [
    HEADER,
    ...albums.map((album) => [
      album.title,
      album.artist,
      album.year?.toString() ?? "",
      album.format ? FORMAT_LABELS[album.format] : "",
      STATUS_LABELS[album.status],
      album.coverUrl ?? "",
      album.notes ?? "",
    ]),
  ];
  const lines = rows.map((row) => row.map(toCell).join(",") + "\r\n");
  // The byte order mark is how Excel knows the file is UTF-8.
  return "\uFEFF" + lines.join("");
}

/** Splits CSV text into rows of cells, unquoting them. */
function parseRows(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let cellStart = true;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') {
        cell += char;
      } else if (text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = false;
      }
    } else if (char === '"' && cellStart) {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") {
        i++;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
    cellStart =
      !quoted && (char === delimiter || char === "\n" || char === "\r");
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// Excel saves CSV with semicolons in countries that write decimals with a
// comma, so go with whichever separator the header line uses most.
function findDelimiter(text: string) {
  const end = text.search(/[\r\n]/);
  const header = end === -1 ? text : text.slice(0, end);
  const count = (delimiter: string) => header.split(delimiter).length - 1;
  return [";", "\t"].reduce(
    (best, delimiter) => (count(delimiter) > count(best) ? delimiter : best),
    ",",
  );
}

/**
 * Reads albums from a CSV file with a header row. Throws InvalidCsvError if it
 * has no Title and Artist columns.
 */
export function readCsv(text: string) {
  const content = text.replace(/^\uFEFF/, "");
  const [header = [], ...records] = parseRows(
    content,
    findDelimiter(content),
  ).filter((row) => row.some((cell) => cell.trim() !== ""));

  const columns = new Map<Column, number>();
  header.forEach((name, index) => {
    const column = COLUMNS[name.toLowerCase().replace(/[^a-z]/g, "")];
    if (column && !columns.has(column)) {
      columns.set(column, index);
    }
  });
  if (!columns.has("title") || !columns.has("artist")) {
    throw new InvalidCsvError();
  }

  const read = (record: string[], column: Column) => {
    const index = columns.get(column);
    const value = index === undefined ? "" : (record[index] ?? "");
    // Undoes the apostrophe the export adds in front of formula characters.
    return value.replace(/^'(?=[=+\-@\t\r])/, "");
  };

  const albums = records
    .map((record) =>
      toAlbum({
        title: read(record, "title"),
        artist: read(record, "artist"),
        year: read(record, "year"),
        format: read(record, "format"),
        // Rows without a status are albums you have.
        status: read(record, "status").trim().toLowerCase() || "owned",
        coverUrl: read(record, "coverUrl"),
        notes: read(record, "notes"),
      }),
    )
    .filter((album) => album !== undefined);
  return { albums, unreadable: records.length - albums.length };
}
