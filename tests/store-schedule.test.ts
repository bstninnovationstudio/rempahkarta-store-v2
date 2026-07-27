import test from "node:test";
import assert from "node:assert/strict";
import { formatWibDateTime } from "../lib/store-schedule";

test("formatWibDateTime formats dates into Indonesian WIB time", () => {
  const date = new Date("2026-07-28T16:59:00.000Z"); // 23:59 WIB (UTC+7)
  const formatted = formatWibDateTime(date);
  assert.match(formatted, /28 Juli 2026/);
  assert.match(formatted, /WIB/);
});

test("Schedule overlap detection logic checks time windows", () => {
  const existingStart = new Date("2026-08-01T10:00:00Z");
  const existingEnd = new Date("2026-08-05T10:00:00Z");

  // Helper for overlap condition: newStart < existingEnd AND newEnd > existingStart
  function isOverlapping(newStart: Date, newEnd: Date): boolean {
    return newStart < existingEnd && newEnd > existingStart;
  }

  // Case 1: Completely inside -> Overlaps
  assert.equal(isOverlapping(new Date("2026-08-02T10:00:00Z"), new Date("2026-08-04T10:00:00Z")), true);

  // Case 2: Starts before, ends during -> Overlaps
  assert.equal(isOverlapping(new Date("2026-07-31T10:00:00Z"), new Date("2026-08-02T10:00:00Z")), true);

  // Case 3: Completely after -> Does not overlap
  assert.equal(isOverlapping(new Date("2026-08-06T10:00:00Z"), new Date("2026-08-10T10:00:00Z")), false);

  // Case 4: Completely before -> Does not overlap
  assert.equal(isOverlapping(new Date("2026-07-25T10:00:00Z"), new Date("2026-07-30T10:00:00Z")), false);

  // Case 5: Touching boundary -> Does not overlap
  assert.equal(isOverlapping(new Date("2026-08-05T10:00:00Z"), new Date("2026-08-10T10:00:00Z")), false);
});

test("30-minute advance notice window logic", () => {
  const now = new Date("2026-07-27T10:00:00Z");
  const startAtIn20Mins = new Date("2026-07-27T10:20:00Z");
  const startAtIn45Mins = new Date("2026-07-27T10:45:00Z");

  const thirtyMinsFromNow = new Date(now.getTime() + 30 * 60 * 1000);

  // 20 mins from now is within 30 minutes window -> Should show advance notice
  assert.equal(startAtIn20Mins > now && startAtIn20Mins <= thirtyMinsFromNow, true);

  // 45 mins from now is outside 30 minutes window -> Should NOT show advance notice yet
  assert.equal(startAtIn45Mins > now && startAtIn45Mins <= thirtyMinsFromNow, false);
});
