import { SiConnector } from "../types";
import { SI } from "../../engine/types";
import { sampleInput } from "../../engine/fixtures";

const SI_BASE = "https://si-retrieval.example.internal/si";

/**
 * Mock SI Retrieval App connector (SPEC §11, Phase 5). Given a batch of OR
 * numbers, returns the canned SI records (with a link), mirroring what the
 * real app would report for "was this SI retrieved?".
 */
export const mockSiConnector: SiConnector = {
  name: "Mock SI Retrieval App (canned)",
  live: false,
  async retrieveSis(orNumbers: string[]): Promise<SI[]> {
    const wanted = new Set(orNumbers);
    return sampleInput.sis
      .filter((s) => wanted.has(s.or_number))
      .map((s) => ({
        ...s,
        si_url: s.retrieved
          ? `${SI_BASE}?or=${encodeURIComponent(s.or_number)}`
          : null,
      }));
  },
};
