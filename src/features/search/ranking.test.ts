import { describe, expect, it } from "vitest";

import { rankSearchResults } from "@/features/search/ranking";
import type { SearchResult } from "@/features/search/types";

function item(entityId: string, title: string, reference?: string): SearchResult {
  return { entityType: "employee", entityId, title, reference, icon: "user", deepLink: `/employees/${entityId}/profile`, score: 0 };
}

describe("deterministic search ranking", () => {
  it("ranks exact code above a title containing the code", () => {
    const result = rankSearchResults("NV001", [item("name", "Nhân viên NV001"), item("code", "Nguyễn Văn A", "NV001")]);
    expect(result[0].entityId).toBe("code");
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it("matches Vietnamese text without relying on diacritics", () => {
    const result = rankSearchResults("nguyen van", [item("1", "Nguyễn Văn An"), item("2", "Trần Thị Bình")]);
    expect(result[0].entityId).toBe("1");
  });
});
