/**
 * Discovery Call spec §3: "Industry — searchable, alias-aware single-select."
 * A controlled combobox, not free text: the customer may type an industry,
 * organisation type, or a familiar Dutch/English term; matching aliases
 * surface the correct canonical category, and only the canonical value is
 * ever stored. Aliases are search terms only — they never become new
 * stored values.
 */
export const INDUSTRY_OPTIONS = [
  "Accounting",
  "Advertising & Marketing",
  "Aerospace & Defense",
  "Agriculture & Farming",
  "Architecture & Design",
  "Automotive",
  "Banking",
  "Biotechnology & Life Sciences",
  "Business & Professional Services",
  "Construction",
  "Consulting",
  "Consumer Goods",
  "Cybersecurity",
  "Data & Analytics",
  "E-commerce",
  "Education",
  "Energy & Utilities",
  "Engineering",
  "Entertainment & Media",
  "Financial Services",
  "Food & Beverage",
  "Government & Public Sector",
  "Healthcare",
  "Hospitality & Travel",
  "Human Resources & Recruitment",
  "Insurance",
  "Legal Services",
  "Logistics & Supply Chain",
  "Manufacturing",
  "Nonprofit & Social Impact",
  "Pharmaceuticals",
  "Property & Real Estate",
  "Retail",
  "SaaS & Software",
  "Security Services",
  "Telecommunications",
  "Technology & IT",
  "Transportation & Mobility",
  "Other",
] as const;

export type IndustryOption = (typeof INDUSTRY_OPTIONS)[number];

/**
 * Minimum required alias examples from the spec, plus the obvious mirror
 * entries. Search-only: matching one of these surfaces the canonical option
 * above for the customer to confirm/select — nothing here is ever stored.
 */
const ALIASES: Record<IndustryOption, string[]> = {
  Healthcare: [
    "healthcare", "zorg", "hospital", "ziekenhuis", "dentist", "tandarts",
    "doctor", "huisarts", "clinic", "kliniek", "nursing home", "care home",
    "ouderenzorg", "care",
  ],
  "Government & Public Sector": [
    "government", "overheid", "municipality", "gemeente", "ministry",
    "ministerie", "public authority", "government agency",
  ],
  Construction: ["construction", "bouw", "bouwbedrijf", "building contractor", "contractor"],
  "SaaS & Software": ["saas", "software", "software company", "softwarebedrijf"],
  "E-commerce": ["e-commerce", "ecommerce", "webshop", "online store"],
  "Transportation & Mobility": [
    "transport", "transportation", "transportbedrijf", "mobility", "logistiek",
  ],
  Accounting: ["accounting", "boekhouding", "accountant"],
  "Advertising & Marketing": ["advertising", "marketing", "reclame"],
  "Aerospace & Defense": ["aerospace", "defense", "defensie", "luchtvaart"],
  "Agriculture & Farming": ["agriculture", "farming", "landbouw", "boerderij"],
  "Architecture & Design": ["architecture", "architectuur", "design"],
  Automotive: ["automotive", "car", "auto", "autobedrijf"],
  Banking: ["banking", "bank"],
  "Biotechnology & Life Sciences": ["biotech", "biotechnology", "life sciences"],
  "Business & Professional Services": ["professional services", "zakelijke dienstverlening"],
  Consulting: ["consulting", "consultancy", "advies"],
  "Consumer Goods": ["consumer goods", "fmcg"],
  Cybersecurity: ["cybersecurity", "cyber security", "infosec"],
  "Data & Analytics": ["data", "analytics", "data analytics"],
  Education: ["education", "school", "onderwijs", "university", "universiteit"],
  "Energy & Utilities": ["energy", "energie", "utilities", "nutsbedrijf"],
  Engineering: ["engineering", "techniek"],
  "Entertainment & Media": ["entertainment", "media", "amusement"],
  "Financial Services": ["financial services", "finance", "financiën"],
  "Food & Beverage": ["food", "beverage", "voedsel", "horeca eten"],
  "Hospitality & Travel": ["hospitality", "travel", "horeca", "hotel", "reizen"],
  "Human Resources & Recruitment": ["hr", "human resources", "recruitment", "werving"],
  Insurance: ["insurance", "verzekering"],
  "Legal Services": ["legal", "law firm", "advocaat", "juridisch"],
  "Logistics & Supply Chain": ["logistics", "supply chain", "logistiek"],
  Manufacturing: ["manufacturing", "productie", "fabriek", "factory"],
  "Nonprofit & Social Impact": ["nonprofit", "ngo", "charity", "goed doel"],
  Pharmaceuticals: ["pharma", "pharmaceuticals", "farmaceutisch"],
  "Property & Real Estate": ["real estate", "property", "vastgoed", "makelaar"],
  Retail: ["retail", "shop", "winkel"],
  "Security Services": ["security services", "beveiliging"],
  Telecommunications: ["telecom", "telecommunications"],
  "Technology & IT": ["technology", "it", "tech", "ict"],
  Other: [],
};

export interface IndustryMatch {
  option: IndustryOption;
  /** True when the match came from the canonical label itself, not an alias. */
  exact: boolean;
}

/** Normalizes case and punctuation/spacing so "e-commerce", "E Commerce"
 * and "ecommerce" all compare equal. */
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[.,-]/g, " ").replace(/\s+/g, " ").trim();
}

/** Case-insensitive, punctuation/spacing-tolerant search across the
 * canonical labels and their aliases. */
export function searchIndustries(query: string): IndustryMatch[] {
  const q = normalize(query);
  if (!q) return INDUSTRY_OPTIONS.map((option) => ({ option, exact: true }));

  const results: IndustryMatch[] = [];
  for (const option of INDUSTRY_OPTIONS) {
    const label = normalize(option);
    if (label.includes(q)) {
      results.push({ option, exact: true });
      continue;
    }
    const hit = ALIASES[option].some((a) => normalize(a).includes(q));
    if (hit) results.push({ option, exact: false });
  }
  return results;
}
