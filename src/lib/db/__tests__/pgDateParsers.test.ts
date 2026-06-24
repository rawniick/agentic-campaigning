import { describe, it, expect } from "vitest";
import { types as pgTypes } from "pg";
import { configurePgDateAsString } from "../server";

// Regression fuer den Prod-Crash nach Brief-Submit (React #31 "Objects are not
// valid as a React child", arg = [object Date]): pg parst DATE-Spalten
// (datum_von/datum_bis) per Default zu JS-Date-Objekten, die direkt in JSX
// gerendert wurden. PGlite (Test-DB) liefert strings — deshalb blieb der Bug in
// Tests unsichtbar. Dieser Test sichert die Parser-Registrierung am pg-Modul ab.
describe("pg DATE/TIMESTAMP type parsers", () => {
  it("liefert DATE/TIMESTAMP/TIMESTAMPTZ als rohen string statt Date-Objekt", () => {
    configurePgDateAsString();

    const OID_DATE = 1082;
    const OID_TIMESTAMP = 1114;
    const OID_TIMESTAMPTZ = 1184;

    const parseDate = pgTypes.getTypeParser(OID_DATE);
    const parseTimestamp = pgTypes.getTypeParser(OID_TIMESTAMP);
    const parseTimestamptz = pgTypes.getTypeParser(OID_TIMESTAMPTZ);

    const date = parseDate("2026-05-01");
    expect(typeof date).toBe("string");
    expect(date).toBe("2026-05-01");

    const ts = parseTimestamp("2026-05-01 10:00:00");
    expect(typeof ts).toBe("string");
    expect(ts).toBe("2026-05-01 10:00:00");

    const tstz = parseTimestamptz("2026-05-01 10:00:00+00");
    expect(typeof tstz).toBe("string");
    expect(tstz).toBe("2026-05-01 10:00:00+00");
  });
});
