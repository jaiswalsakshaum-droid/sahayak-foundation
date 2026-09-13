import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Bot,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Compass,
  ShieldCheck,
  ExternalLink,
  FileText,
  Filter,
  RefreshCw,
  Sparkles,
  Building2,
  Check,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getAllSchemes,
  findRelevantSchemes,
  type SchemeMatch,
  type SchemeFullDetail,
} from "@/lib/services";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AppShell } from "@/components/sahayak";
import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/schemes")({
  beforeLoad: async () => {
    await requireAuth();
  },
  component: SchemesPage,
});

const CATEGORIES = [
  "All",
  "Education",
  "Healthcare",
  "Agriculture",
  "Housing",
  "Women & Child",
  "Employment & Pension",
  "Business & Loans",
  "Skill & Employment",
];

const exampleSearches = [
  "Scholarship for daughter",
  "PM-KISAN Samman Nidhi",
  "Ayushman Bharat health card",
  "Solar rooftop subsidy",
  "PM Mudra business loan",
  "Ladli Bahin Yojana",
];

function SchemesPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [allSchemes, setAllSchemes] = useState<SchemeFullDetail[]>([]);
  const [searchResults, setSearchResults] = useState<SchemeMatch[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState<SchemeFullDetail | SchemeMatch | null>(null);

  // Load all verified schemes on mount
  useEffect(() => {
    let mounted = true;
    async function loadCatalog() {
      setIsLoading(true);
      try {
        const data = await getAllSchemes();
        if (mounted) {
          setAllSchemes(data);
        }
      } catch (err) {
        console.error("Failed to load scheme catalog:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    loadCatalog();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSearch = async (searchQuery: string = query) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(null);
      return;
    }
    setQuery(trimmed);
    setIsSearching(true);

    try {
      const results = await findRelevantSchemes(
        trimmed,
        selectedCategory !== "All" ? selectedCategory : undefined,
      );
      setSearchResults(results);
    } catch (e) {
      console.error("Scheme search error:", e);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setQuery("");
    setSearchResults(null);
  };

  const displayedSchemes = useMemo(() => {
    if (searchResults !== null) {
      return searchResults;
    }
    if (selectedCategory === "All") {
      return allSchemes;
    }
    return allSchemes.filter((s) => s.category.toLowerCase() === selectedCategory.toLowerCase());
  }, [allSchemes, searchResults, selectedCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: allSchemes.length };
    for (const s of allSchemes) {
      counts[s.category] = (counts[s.category] || 0) + 1;
    }
    return counts;
  }, [allSchemes]);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Breadcrumb & Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-ice hover:text-foreground transition-colors shadow-sm"
          >
            <ArrowLeft className="size-3.5" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-2 text-[11px] text-brand-soft">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-sage" />
            Scheme Intelligence Engine · {allSchemes.length} Active Schemes
          </div>
        </div>

        {/* Hero Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-mist bg-card px-2.5 py-0.5 text-xs font-medium text-brand-soft">
              <Compass className="size-3.5 text-brand" /> Verified Civic Repository
            </span>
            <h1 className="text-3xl font-display font-semibold mt-2 mb-1">
              Discover Government Schemes
            </h1>
            <p className="text-sm text-muted-foreground">
              Search official central and state welfare programs, evaluate eligibility criteria, and
              apply with AI assistance.
            </p>
          </div>
          <Button asChild className="shrink-0 bg-brand hover:bg-brand/90 text-xs shadow-sm">
            <Link to="/assistant">
              <Sparkles className="size-3.5 mr-1.5" />
              Check Eligibility with Assistant
            </Link>
          </Button>
        </div>

        {/* Search Box */}
        <div className="rounded-2xl border border-line bg-card p-5 shadow-sm space-y-4">
          <div className="relative flex items-center">
            <Search className="absolute left-4 size-5 text-muted-foreground" />
            <input
              type="text"
              className="w-full h-13 pl-12 pr-28 rounded-xl border border-line bg-ice-2/40 text-base focus:outline-none focus:ring-2 focus:ring-brand shadow-sm transition-all placeholder:text-muted-foreground/70"
              placeholder="Search by scheme name, keywords (e.g. Kisan, scholarship, solar, loan)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <div className="absolute right-2 flex items-center gap-1.5">
              {query && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSearch}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              )}
              <Button
                size="sm"
                className="h-9 px-4 text-xs bg-brand hover:bg-brand/90"
                onClick={() => handleSearch()}
                disabled={isSearching}
              >
                {isSearching ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                Search
              </Button>
            </div>
          </div>

          {/* Popular Search Suggestions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground mr-1">Suggested queries:</span>
            {exampleSearches.map((ex) => (
              <button
                key={ex}
                className="px-2.5 py-1 text-xs rounded-full border border-line bg-card hover:border-brand/50 hover:bg-brand/5 transition-colors text-muted-foreground hover:text-foreground shadow-2xs"
                onClick={() => handleSearch(ex)}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0 text-xs font-semibold text-muted-foreground pr-2 border-r border-line">
            <Filter className="size-3.5 text-brand" /> Category
          </div>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat && searchResults === null;
            const count = categoryCounts[cat] || 0;
            return (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setSearchResults(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-all border ${
                  isSelected
                    ? "bg-brand text-white border-brand shadow-xs"
                    : "bg-card border-line text-muted-foreground hover:border-brand/40 hover:text-foreground hover:bg-ice"
                }`}
              >
                {cat} {count > 0 && <span className="opacity-75 text-[10px] ml-1">({count})</span>}
              </button>
            );
          })}
        </div>

        {/* Search In-Progress Loader */}
        {isSearching && (
          <div className="flex flex-col items-center justify-center py-16 bg-card rounded-2xl border border-line text-muted-foreground shadow-sm animate-in fade-in duration-200">
            <div className="relative mb-4">
              <span className="grid size-12 place-items-center rounded-full bg-brand/10 text-brand">
                <Globe className="size-6 animate-spin" />
              </span>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-sage ring-2 ring-card">
                <CheckCircle2 className="size-3 text-white" />
              </span>
            </div>
            <p className="font-semibold text-foreground text-sm flex items-center gap-2">
              Searching Google & Official Government Portals...
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm text-center">
              Querying national databases, myScheme repository, and ministry guidelines to verify
              authentic schemes in real-time.
            </p>
          </div>
        )}

        {/* Catalog / Results Display */}
        {!isSearching && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-display font-semibold text-foreground">
                  {searchResults !== null
                    ? `Found ${displayedSchemes.length} matching scheme${displayedSchemes.length === 1 ? "" : "s"}`
                    : `${selectedCategory === "All" ? "All Verified Schemes" : selectedCategory} (${displayedSchemes.length})`}
                </h2>
                {searchResults !== null && (
                  <button
                    onClick={handleClearSearch}
                    className="text-xs text-brand hover:underline font-medium ml-2"
                  >
                    View All ({allSchemes.length})
                  </button>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                Updated in real-time from official portals
              </span>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-56 rounded-2xl border border-line bg-card/60 animate-pulse p-5"
                  />
                ))}
              </div>
            ) : displayedSchemes.length === 0 ? (
              <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-line shadow-sm">
                <div className="size-12 rounded-full bg-mist grid place-items-center mx-auto mb-3 text-muted-foreground">
                  <Search className="size-6 opacity-60" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  No matching government schemes found
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto mb-4">
                  No official Central or State welfare scheme matches the search term "{query}". Try
                  checking your spelling or searching broader civic keywords.
                </p>
                <Button size="sm" variant="outline" onClick={handleClearSearch} className="text-xs">
                  Reset Search & View All Schemes
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {displayedSchemes.map((scheme) => (
                  <div
                    key={scheme.id}
                    className="flex flex-col rounded-2xl border border-line bg-card p-5 shadow-sm hover:border-brand/50 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                          {scheme.category}
                        </span>
                        {"jurisdiction" in scheme && scheme.jurisdiction && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-mist/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            <Building2 className="size-3" /> {scheme.jurisdiction}
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sage shrink-0 bg-sage/10 px-2 py-0.5 rounded-full">
                        <ShieldCheck className="size-3" /> Official
                      </span>
                    </div>

                    <h3 className="font-semibold text-base mb-1.5 line-clamp-2 group-hover:text-brand transition-colors">
                      {scheme.name}
                    </h3>
                    <p className="text-brand font-bold mb-2 text-sm leading-snug">
                      {scheme.benefit}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4 flex-1 line-clamp-3 leading-relaxed">
                      {scheme.description}
                    </p>

                    <div className="flex items-center justify-between pt-3 border-t border-line/60 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1 text-[11px]">
                        <FileText className="size-3 text-brand" />
                        {scheme.reqDocs
                          ? `${scheme.reqDocs.length} required proofs`
                          : "Aadhaar verified"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {scheme.lastVerified || "Active"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-ice/40 hover:bg-ice hover:text-foreground transition-all text-xs h-8 border-line"
                        onClick={() => setSelectedScheme(scheme)}
                      >
                        View Details
                      </Button>
                      <Button
                        size="sm"
                        className="bg-brand hover:bg-brand/90 text-white transition-all text-xs h-8 font-medium"
                        onClick={() => {
                          navigate({
                            to: "/assistant",
                            search: { schemeId: scheme.id, schemeName: scheme.name } as any,
                          });
                        }}
                      >
                        Apply Directly
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ecosystem Connection Footer */}
        <div className="rounded-xl border border-line bg-card p-4 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2 mt-8">
          <span className="font-medium text-foreground">
            Your connected ecosystem: Sahayak works alongside myScheme, UMANG and DigiLocker — it
            never replaces them.
          </span>
          <Button asChild variant="link" size="sm" className="px-1 text-xs text-brand">
            <Link to="/profile">
              Manage connections <ChevronRight className="size-3 ml-0.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Comprehensive Scheme Details Modal */}
      <Dialog open={!!selectedScheme} onOpenChange={() => setSelectedScheme(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedScheme && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand/10 text-brand">
                    {selectedScheme.category}
                  </span>
                  {"jurisdiction" in selectedScheme && selectedScheme.jurisdiction && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                      {selectedScheme.jurisdiction} Scheme
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sage/15 text-sage flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> Verified Active
                  </span>
                </div>
                <DialogTitle className="text-xl font-display text-foreground pr-8">
                  {selectedScheme.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Official verified government welfare program specifications and requirement
                  matrix.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-5">
                {/* Benefit Highlight Card */}
                <div className="p-4 rounded-xl border border-brand/20 bg-brand/5 space-y-1">
                  <h4 className="text-[11px] font-semibold text-brand uppercase tracking-wider">
                    Direct Citizen Benefit
                  </h4>
                  <p className="text-lg font-bold text-brand">{selectedScheme.benefit}</p>
                </div>

                {/* Scheme Description */}
                <div>
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                    Program Overview
                  </h4>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {selectedScheme.description}
                  </p>
                </div>

                {/* Eligibility Criteria Table (if available) */}
                {"eligibilityRules" in selectedScheme &&
                  selectedScheme.eligibilityRules &&
                  selectedScheme.eligibilityRules.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                        Eligibility Rules & Verification Evidence
                      </h4>
                      <div className="rounded-xl border border-line overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-ice-2 text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 font-medium">Criterion</th>
                              <th className="px-3 py-2 font-medium">Requirement</th>
                              <th className="px-3 py-2 font-medium">Evidence Proof</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line bg-card">
                            {selectedScheme.eligibilityRules.map((rule, idx) => (
                              <tr key={idx}>
                                <td className="px-3 py-2.5 font-medium text-foreground">
                                  {rule.criterion_name}
                                </td>
                                <td className="px-3 py-2.5 text-muted-foreground">
                                  {rule.requirement}
                                </td>
                                <td className="px-3 py-2.5 text-brand-soft text-[11px] font-medium">
                                  {rule.evidence_source || "Identity Proof"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                {/* Required Documents */}
                <div>
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                    Mandatory Documents & KYC
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedScheme.reqDocs?.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2.5 rounded-lg border border-line bg-card text-xs text-foreground"
                      >
                        <Check className="size-3.5 text-sage shrink-0" />
                        <span>{doc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Official Source Link */}
                {"officialSource" in selectedScheme && selectedScheme.officialSource && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-2">
                    <span>Official Portal:</span>
                    <span className="font-mono text-brand truncate max-w-sm">
                      {selectedScheme.officialSource}
                    </span>
                  </div>
                )}

                {/* Action Footer */}
                <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-line">
                  <p className="text-xs text-muted-foreground">
                    Last verified: {selectedScheme.lastVerified || "Recently"}
                  </p>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedScheme(null)}
                      className="text-xs flex-1 sm:flex-none"
                    >
                      Close
                    </Button>
                    <Button
                      size="sm"
                      className="bg-brand hover:bg-brand/90 text-xs gap-1.5 flex-1 sm:flex-none font-medium text-white shadow-sm"
                      onClick={() => {
                        const schemeId = selectedScheme.id;
                        const schemeName = selectedScheme.name;
                        setSelectedScheme(null);
                        navigate({
                          to: "/assistant",
                          search: { schemeId, schemeName } as any,
                        });
                      }}
                    >
                      <FileText className="size-3.5" />
                      Apply Directly to this Scheme
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
