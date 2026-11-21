import { Album } from "../types";
import { createCsv } from "./csv";
import { createJson } from "./json";

function download(fileName: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // Safari can still be reading the file just after the click.
  setTimeout(() => URL.revokeObjectURL(url), 40_000);
}

// en-CA writes dates as YYYY-MM-DD, in local time.
const today = () => new Date().toLocaleDateString("en-CA");

/** Downloads the collection as a JSON file, which keeps everything. */
export const downloadJson = (albums: Album[]) =>
  download(
    `album-tracker-${today()}.json`,
    createJson(albums),
    "application/json",
  );

/** Downloads the collection as a CSV file, for spreadsheets. */
export const downloadCsv = (albums: Album[]) =>
  download(`album-tracker-${today()}.csv`, createCsv(albums), "text/csv");
