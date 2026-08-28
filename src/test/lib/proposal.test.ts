import { describe, expect, it } from "vitest";

import {
  MAX_PROPOSED,
  validateProposal,
} from "../../../supabase/functions/ai-chat/proposal";
import { describeProposed, type ProposedPerson } from "@/lib/queries/aiExtract";

/**
 * Kiểm phần "không tin model" của GĐ 5.
 *
 * `strict` trong schema chỉ đảm bảo HÌNH DẠNG json, không đảm bảo nội
 * dung hợp lý. Mỗi ca dưới đây là một kiểu rác mà model thật sự có thể
 * trả về, và nếu lọt qua thì nó thành người thật trong gia phả.
 */

const ok = {
  tempId: "p1",
  fullName: "Nguyễn Văn A",
  gender: "M",
  birthYear: 1940,
  deathYear: null,
  relation: "child",
  relatedTo: "anchor-id",
  note: null,
};

describe("validateProposal", () => {
  it("nhận đề xuất hợp lệ", () => {
    const { proposal, error } = validateProposal({ people: [ok] });
    expect(error).toBeNull();
    expect(proposal?.people[0].fullName).toBe("Nguyễn Văn A");
  });

  it("từ chối danh sách trống", () => {
    expect(validateProposal({ people: [] }).proposal).toBeNull();
    expect(validateProposal({}).proposal).toBeNull();
  });

  it(`từ chối quá ${MAX_PROPOSED} người trong một lượt`, () => {
    const many = Array.from({ length: MAX_PROPOSED + 1 }, (_, i) => ({
      ...ok,
      tempId: `p${i}`,
    }));
    expect(validateProposal({ people: many }).proposal).toBeNull();
  });

  it("từ chối mã tạm trùng nhau", () => {
    const dup = [ok, { ...ok, fullName: "Người khác" }];
    expect(validateProposal({ people: dup }).proposal).toBeNull();
  });

  it("từ chối giới tính lạ — cột gender chỉ nhận M/F", () => {
    expect(validateProposal({ people: [{ ...ok, gender: "X" }] }).proposal).toBeNull();
  });

  it("từ chối quan hệ ngoài ba loại đã hỗ trợ", () => {
    expect(
      validateProposal({ people: [{ ...ok, relation: "cousin" }] }).proposal,
    ).toBeNull();
  });

  it("từ chối người tự gắn vào chính mình", () => {
    expect(
      validateProposal({ people: [{ ...ok, relatedTo: "p1" }] }).proposal,
    ).toBeNull();
  });

  it("từ chối năm sinh muộn hơn năm mất", () => {
    expect(
      validateProposal({
        people: [{ ...ok, birthYear: 1990, deathYear: 1950 }],
      }).proposal,
    ).toBeNull();
  });

  it("bỏ qua năm vô lý thay vì ghi bừa vào gia phả", () => {
    const { proposal } = validateProposal({
      people: [{ ...ok, birthYear: 0, deathYear: 99999 }],
    });
    expect(proposal?.people[0].birthYear).toBeNull();
    expect(proposal?.people[0].deathYear).toBeNull();
  });

  it("từ chối tên trống hoặc dài bất thường", () => {
    expect(validateProposal({ people: [{ ...ok, fullName: "  " }] }).proposal).toBeNull();
    expect(
      validateProposal({ people: [{ ...ok, fullName: "x".repeat(101) }] }).proposal,
    ).toBeNull();
  });

  it("cho phép gắn vào người đứng TRƯỚC trong cùng đề xuất", () => {
    const { proposal, error } = validateProposal({
      people: [ok, { ...ok, tempId: "p2", fullName: "Con", relatedTo: "p1" }],
    });
    expect(error).toBeNull();
    expect(proposal?.people).toHaveLength(2);
  });

  it("từ chối gắn vào người đứng SAU — client tạo tuần tự nên id chưa có", () => {
    const { proposal } = validateProposal({
      people: [
        { ...ok, tempId: "p1", relatedTo: "p2" },
        { ...ok, tempId: "p2" },
      ],
    });
    expect(proposal).toBeNull();
  });
});

describe("describeProposed", () => {
  const name = () => "Nguyễn Văn Tổ";
  const base: ProposedPerson = {
    tempId: "p1",
    fullName: "Nguyễn Thị B",
    gender: "F",
    birthYear: 1945,
    deathYear: 2010,
    relation: "child",
    relatedTo: "anchor",
    note: null,
  };

  it("viết thành câu người già đọc được, không hiện id", () => {
    expect(describeProposed(base, name)).toBe(
      "Nguyễn Thị B (nữ, sinh 1945, mất 2010) — con của Nguyễn Văn Tổ",
    );
  });

  it("cha/mẹ suy từ giới tính, không bắt người dùng tự dịch", () => {
    expect(describeProposed({ ...base, relation: "parent" }, name)).toContain(
      "mẹ của",
    );
    expect(
      describeProposed({ ...base, relation: "parent", gender: "M" }, name),
    ).toContain("cha của");
  });

  it("không biết năm thì không bịa ra dấu phẩy trống", () => {
    expect(
      describeProposed({ ...base, birthYear: null, deathYear: null }, name),
    ).toBe("Nguyễn Thị B (nữ) — con của Nguyễn Văn Tổ");
  });
});
