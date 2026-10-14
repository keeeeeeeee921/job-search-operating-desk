import { describe, expect, it } from "vitest";
import {
  cleanJobIdentityFields,
  decodeHtmlEntities,
  restoreAcronymCasing,
  stripLocationNoise
} from "@/lib/field-noise";
import { capitalizeWords } from "@/lib/utils";

describe("decodeHtmlEntities", () => {
  it("decodes named, decimal and hex entities, including double-encoded ones", () => {
    expect(decodeHtmlEntities("Fp&amp;a")).toBe("Fp&a");
    expect(decodeHtmlEntities("Insights &amp; Strategy")).toBe("Insights & Strategy");
    expect(decodeHtmlEntities("Cincinnati Children&#39;s")).toBe("Cincinnati Children's");
    expect(decodeHtmlEntities("Macy&#x27;s")).toBe("Macy's");
    expect(decodeHtmlEntities("R&amp;amp;D")).toBe("R&D");
    expect(decodeHtmlEntities("Plain & simple")).toBe("Plain & simple");
  });
});

describe("stripLocationNoise", () => {
  it("cuts posting metadata glued onto the location", () => {
    expect(stripLocationNoise("San JoseEmployment Type:RegularJob Code:A107949")).toBe(
      "San Jose"
    );
    expect(stripLocationNoise("Austin, TX Job Code: 12345")).toBe("Austin, TX");
    expect(stripLocationNoise("Toronto, ON Employment Type: Full time")).toBe(
      "Toronto, ON"
    );
  });

  it("drops aggregator chrome that is not a location", () => {
    expect(stripLocationNoise("Amazon.jobs · s")).toBe("");
    expect(stripLocationNoise("Amazon.jobs · Seattle, WA")).toBe("Seattle, WA");
  });

  it("leaves real locations alone", () => {
    expect(stripLocationNoise("New York, NY, United States (Remote)")).toBe(
      "New York, NY, United States (Remote)"
    );
    expect(stripLocationNoise("Remote")).toBe("Remote");
  });
});

describe("restoreAcronymCasing", () => {
  it("restores whitelisted acronyms without touching other words", () => {
    expect(restoreAcronymCasing("Data Analyst Ii")).toBe("Data Analyst II");
    expect(restoreAcronymCasing("(usa) Senior, Data Analyst")).toBe(
      "(USA) Senior, Data Analyst"
    );
    expect(restoreAcronymCasing("Fp&a Analyst")).toBe("FP&A Analyst");
    expect(restoreAcronymCasing("Senior Saas Bi Analyst, Ml/Nlp")).toBe(
      "Senior SaaS BI Analyst, Ml/Nlp"
    );
    expect(restoreAcronymCasing("Business Analyst")).toBe("Business Analyst");
    expect(restoreAcronymCasing("Senior Analyst (Sql, Etl)")).toBe("Senior Analyst (SQL, ETL)");
  });

  it("only restores word-like acronyms (IT, MS, BS) where the context reads as an acronym", () => {
    expect(restoreAcronymCasing("It Data Analyst")).toBe("IT Data Analyst");
    expect(restoreAcronymCasing("It Infrastructure & Cloud Operations Intern")).toBe(
      "IT Infrastructure & Cloud Operations Intern"
    );
    expect(restoreAcronymCasing("Analyst, It Operations")).toBe("Analyst, IT Operations");
    expect(restoreAcronymCasing("Senior Analyst (it)")).toBe("Senior Analyst (IT)");
    expect(restoreAcronymCasing("Data Analyst - Hit It Rich")).toBe("Data Analyst - Hit It Rich");
    expect(restoreAcronymCasing("Do it Best")).toBe("Do it Best");
    expect(restoreAcronymCasing("Go Store It Self-Storage")).toBe("Go Store It Self-Storage");
    expect(restoreAcronymCasing("Ms Data Analyst")).toBe("MS Data Analyst");
  });
});

describe("company and title separators", () => {
  it("trims LinkedIn separator leftovers", () => {
    expect(cleanJobIdentityFields({
      company: "Capital Healthcare Planning ·",
      roleTitle: "Data Analyst |",
      location: "New York, NY ·"
    })).toEqual({
      company: "Capital Healthcare Planning",
      roleTitle: "Data Analyst",
      location: "New York, NY"
    });
  });
});

describe("capitalizeWords", () => {
  it("title-cases while keeping acronyms and punctuation-wrapped tokens", () => {
    expect(capitalizeWords("data analyst ii")).toBe("Data Analyst II");
    expect(capitalizeWords("(usa) senior, data analyst")).toBe("(USA) Senior, Data Analyst");
    expect(capitalizeWords("senior fp&a analyst")).toBe("Senior FP&A Analyst");
    expect(capitalizeWords("hr business partner")).toBe("HR Business Partner");
    expect(capitalizeWords("tiktok analyst")).toBe("TikTok Analyst");
    expect(capitalizeWords("phd data scientist, b2b saas")).toBe("PhD Data Scientist, B2B SaaS");
    expect(capitalizeWords("data analyst - hit it rich")).toBe("Data Analyst - Hit It Rich");
    expect(capitalizeWords("it data analyst")).toBe("IT Data Analyst");
  });
});

describe("cleanJobIdentityFields", () => {
  it("cleans all three fields together", () => {
    expect(
      cleanJobIdentityFields({
        company: "Johnson &amp; Johnson",
        roleTitle: "Senior Fp&amp;a Analyst Ii",
        location: "San JoseEmployment Type:RegularJob Code:A107949"
      })
    ).toEqual({
      company: "Johnson & Johnson",
      roleTitle: "Senior FP&A Analyst II",
      location: "San Jose"
    });
  });
});
