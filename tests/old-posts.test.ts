import assert from "node:assert/strict";
import { test } from "node:test";
import { parseStartDate } from "../scripts/old-posts/helpers";

test("parseStartDate takes the first day of every date format the old posts use", () => {
  const cases: [string, string][] = [
    ["March 22, 2024", "2024-03-22"],
    ["April 2, 2024", "2024-04-02"],
    ["June 3rd-9th", "2024-06-03"],
    ["June 10th-16th, 2024", "2024-06-10"],
    ["June 21st-24th, 2024", "2024-06-21"],
    ["June 26th, July 1st and 76th", "2024-06-26"],
    ["July, 7th-8th", "2024-07-07"],
    ["July 12th-18th, 2024", "2024-07-12"],
    ["July 29th, 2024", "2024-07-29"],
    ["July 31th, 2024", "2024-07-31"],
    ["July 23rd-August 9th, 2024", "2024-07-23"],
    ["August 10th-18th", "2024-08-10"],
    ["Sept 5, 2025", "2025-09-05"],
  ];
  for (const [input, expected] of cases) assert.equal(parseStartDate(input, 2024), expected, input);
});

test("parseStartDate returns null when there is no usable date", () => {
  assert.equal(parseStartDate("sometime last spring", 2024), null);
  assert.equal(parseStartDate("March", 2024), null);
});
