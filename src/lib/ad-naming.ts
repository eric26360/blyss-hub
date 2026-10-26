// Reads Blyss ad names (as they appear in Northbeam / Meta) into fields,
// following the "NEW NAMING" tab of the Blyss Creative Log sheet:
//
//   CXXXX-Y _ V1 _ Concept Name _ Product _ Type _ Format _ Angle _ Scent _
//   Creator _ CS _ Editor _ Agency _ Destination _ Offer
//
// "CXXXX" is the concept number, "-Y" an iteration (C5436-1), V1/V2/V3 the variation.
// Empty slots (no creator, no agency) are kept as empty strings between separators.

export const NEW_NAMING_FIELDS = [
  "conceptId",
  "variation",
  "conceptName",
  "product",
  "type",
  "format",
  "angle",
  "scent",
  "creator",
  "strategist",
  "editor",
  "agency",
  "destination",
  "offer",
] as const;

export type ParsedAdName = Partial<Record<(typeof NEW_NAMING_FIELDS)[number], string>> & {
  convention: "new" | "old" | "unknown";
  concept?: number;
  iteration?: number;
};

// Old convention (pre new-naming), e.g.
// Blyss_Mop Soap_Evergreen_Video_Testimonial_Review_Luxury Scent_Multiple Scents_DOJO_PDP
const OLD_NAMING_FIELDS = ["creator", "product", "offer", "type", "format", "angle", "usp", "scent", "agency", "destination"] as const;

const CONCEPT = /^C(\d+)(?:-(\d+))?$/i;

export function parseAdName(name: string, separator = "_"): ParsedAdName {
  const parts = name.trim().split(separator).map((p) => p.trim());
  const concept = parts[0]?.match(CONCEPT);

  if (concept) {
    const out: ParsedAdName = { convention: "new", concept: Number(concept[1]) };
    if (concept[2]) out.iteration = Number(concept[2]);
    NEW_NAMING_FIELDS.forEach((field, i) => {
      if (parts[i]) out[field] = parts[i];
    });
    return out;
  }

  if (parts.length === OLD_NAMING_FIELDS.length) {
    const out: ParsedAdName & Record<string, unknown> = { convention: "old" };
    OLD_NAMING_FIELDS.forEach((field, i) => {
      if (parts[i]) out[field] = parts[i];
    });
    return out;
  }

  return { convention: "unknown" };
}
