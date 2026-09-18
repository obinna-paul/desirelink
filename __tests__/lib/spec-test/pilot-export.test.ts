import { buildPilotAnalysisCsv } from "@/lib/spec-test/pilot-export";

describe("buildPilotAnalysisCsv", () => {
  it("exports analyzable response and score rows without persistent identifiers or timestamps", () => {
    const csv = buildPilotAnalysisCsv([
      {
        instrumentVersion: "spec-v3-pilot.1",
        consentVersion: "2026-09-18.2",
        dataSplit: "development",
        qualityFlags: [],
        responses: [
          {
            itemId: "v3-room-presence",
            kind: "best_worst",
            bestOptionId: "option-a",
            worstOptionId: "option-b",
            bestPresentedIndex: 0,
            worstPresentedIndex: 3,
            elapsedMs: 1450,
          },
        ],
        attractionProfile: {
          warmthResponsiveness: { comparativeScore: 0.25, intensityScore: 0.5, combinedScore: 0.375 },
        },
        uncertaintyProfile: { steadyUnderUncertainty: 2 },
      },
    ]);

    expect(csv).toContain("participant_index,instrument_version,consent_version");
    expect(csv).toContain("v3-room-presence,best_worst,false,1,option-a,option-b,1,4");
    expect(csv).toContain("warmthResponsiveness_combined_score");
    expect(csv).toContain("steadyUnderUncertainty_count");
    expect(csv).not.toMatch(/attempt_id|submission_id|created_at|email|ip_address/i);
  });
});
