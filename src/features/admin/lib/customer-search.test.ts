import { describe, expect, it } from "vitest";
import { customerSearchFilter } from "./customer-search";

/**
 * The list used to search `full_name` only, so an operator holding a phone
 * number had no way to find the caller. What these tests pin down is the two
 * things that make the phone half work at all: the digits are taken out of a
 * formatted number, and nothing typed into the box can be read as PostgREST
 * filter syntax.
 */
describe("customerSearchFilter", () => {
  it("searches name and phone at once", () => {
    expect(customerSearchFilter("99112233")).toBe(
      'full_name.ilike."%99112233%",phone.ilike."%99112233%"',
    );
  });

  it("matches a partial number", () => {
    expect(customerSearchFilter("1122")).toContain('phone.ilike."%1122%"');
  });

  it("strips the formatting the operator reads off the screen", () => {
    // profiles.phone holds bare 8 digits, so «9911 2233» would match nobody.
    for (const typed of ["9911 2233", "9911-2233", "+976 9911 2233"]) {
      expect(customerSearchFilter(typed)).toContain('phone.ilike."%99112233%"');
    }
  });

  it("leaves the phone clause out for a name with no digits", () => {
    expect(customerSearchFilter("Болд")).toBe('full_name.ilike."%Болд%"');
  });

  it("keeps a comma inside the quoted name instead of splitting the filter", () => {
    // A comma separates `or=` clauses; unquoted, «Болд, Дорж» would become a
    // second, malformed clause.
    expect(customerSearchFilter("Болд, Дорж")).toBe(
      'full_name.ilike."%Болд, Дорж%"',
    );
  });

  it("drops a pasted country code, but not digits that could be the number", () => {
    expect(customerSearchFilter("+97699112233")).toBe(
      'full_name.ilike."%+97699112233%",phone.ilike."%99112233%"',
    );
    // «976» on its own is a partial number, not a prefix to strip.
    expect(customerSearchFilter("976")).toContain('phone.ilike."%976%"');
  });

  it("drops the characters that could break out of the quotes", () => {
    expect(customerSearchFilter('Бо"лд\\')).toBe('full_name.ilike."%Болд%"');
  });

  it("returns null when there is nothing to filter on", () => {
    expect(customerSearchFilter("")).toBeNull();
    expect(customerSearchFilter("   ")).toBeNull();
  });
});
