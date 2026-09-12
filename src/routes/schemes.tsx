import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Bot, CheckCircle2, Loader2, ArrowRight, ArrowLeft, ChevronRight, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { understandCitizenNeed, findRelevantSchemes, type SchemeMatch } from "@/lib/services";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppShell } from "@/components/sahayak";
import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/schemes")({
  beforeLoad: async () => {
    await requireAuth();
  },
  component: SchemesPage,
});

const exampleSearches = [
  "Scholarship for my daughter",
  "Farmer support in my state",
  "Housing scheme",
  "Women welfare programs",
  "Employment assistance",
];

function SchemesPage() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SchemeMatch[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState<SchemeMatch | null>(null);

  const handleSearch = async (searchQuery: string = query) => {
    if (!searchQuery.trim()) return;
    setQuery(searchQuery);
    setIsSearching(true);
    setHasSearched(true);

    try {
      const intent = await understandCitizenNeed(searchQuery);
      const schemes = await findRelevantSchemes(intent);
      setResults(schemes);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

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
            Scheme Agent · Civic Discovery Engine
          </div>
        </div>

        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-mist bg-card px-2.5 py-0.5 text-xs font-medium text-brand-soft">
            <Compass className="size-3.5 text-brand" /> Scheme Intelligence
          </span>
          <h1 className="text-3xl font-display font-semibold mt-2 mb-1">Discover Schemes</h1>
          <p className="text-sm text-muted-foreground">
            Search using natural language or keywords, and our Scheme Agent will match benefits across state and national repositories.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-card p-6 shadow-sm space-y-4">
          <div className="relative flex items-center">
            <Search className="absolute left-4 size-5 text-muted-foreground" />
            <input
              type="text"
              className="w-full h-14 pl-12 pr-32 rounded-xl border border-line bg-ice-2/40 text-base focus:outline-none focus:ring-2 focus:ring-brand shadow-sm"
              placeholder="e.g. I am looking for a housing scheme or scholarship..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button
              className="absolute right-2 top-2 bottom-2"
              onClick={() => handleSearch()}
              disabled={isSearching}
            >
              {isSearching ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Search
            </Button>
          </div>

          {!hasSearched && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground mr-1">Popular:</span>
              {exampleSearches.map((ex) => (
                <button
                  key={ex}
                  className="px-3 py-1 text-xs rounded-full border border-line bg-ice-2/60 hover:border-brand/50 hover:bg-brand/5 transition-colors text-muted-foreground hover:text-foreground"
                  onClick={() => handleSearch(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>

        {isSearching && (
          <div className="flex flex-col items-center justify-center py-16 bg-card rounded-2xl border border-line text-muted-foreground">
            <div className="relative mb-6">
              <span className="grid size-12 place-items-center rounded-full bg-brand/10 text-brand">
                <Bot className="size-6 animate-pulse" />
              </span>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-sage ring-2 ring-card">
                <CheckCircle2 className="size-3 text-primary-foreground" />
              </span>
            </div>
            <p className="font-semibold text-foreground">
              Scheme Agent is searching the verified knowledge base...
            </p>
            <p className="text-xs mt-1">Matching your request against 100+ active government schemes.</p>
          </div>
        )}

        {!isSearching && hasSearched && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-display font-semibold">
                Found {results.length} matching {results.length === 1 ? "scheme" : "schemes"}
              </h2>
              <Link
                to="/assistant"
                className="text-xs text-brand font-medium hover:underline flex items-center gap-1"
              >
                Check eligibility with Assistant <ArrowRight className="size-3.5" />
              </Link>
            </div>

            {results.length === 0 ? (
              <div className="text-center py-16 bg-card rounded-2xl border border-line">
                <p className="text-muted-foreground text-sm">No schemes found matching your query.</p>
                <p className="text-xs text-muted-foreground mt-1">Try broader terms like "scholarship", "agriculture", or "pension".</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {results.map((scheme) => (
                  <div
                    key={scheme.id}
                    className="flex flex-col rounded-2xl border border-line bg-card p-5 shadow-sm hover:border-brand/40 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
                        {scheme.category}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-semibold text-sage">
                        <CheckCircle2 className="size-3" /> {scheme.matchScore}% match
                      </span>
                    </div>
                    <h3 className="font-semibold text-base mb-1.5 line-clamp-2">{scheme.name}</h3>
                    <p className="text-brand font-semibold mb-2 text-sm">{scheme.benefit}</p>
                    <p className="text-xs text-muted-foreground mb-5 flex-1 line-clamp-3 leading-relaxed">
                      {scheme.description}
                    </p>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full bg-ice-2 hover:bg-brand hover:text-white transition-colors"
                      onClick={() => setSelectedScheme(scheme)}
                    >
                      View Details & Requirements
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ecosystem Connection Footer */}
        <div className="rounded-xl border border-line bg-card p-4 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2 mt-8">
          <span className="font-medium text-foreground">
            Your connected ecosystem: Sahayak works alongside myScheme, UMANG and DigiLocker — it never replaces them.
          </span>
          <Button asChild variant="link" size="sm" className="px-1 text-xs text-brand">
            <Link to="/profile">
              Manage connections <ChevronRight className="size-3 ml-0.5" />
            </Link>
          </Button>
        </div>
      </div>

      <Dialog open={!!selectedScheme} onOpenChange={() => setSelectedScheme(null)}>
        <DialogContent className="max-w-2xl">
          {selectedScheme && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl pr-8">{selectedScheme.name}</DialogTitle>
              </DialogHeader>
              <div className="mt-4 space-y-5">
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Benefit
                  </h4>
                  <p className="text-base font-semibold text-brand">{selectedScheme.benefit}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Description
                  </h4>
                  <p className="text-sm text-foreground leading-relaxed">
                    {selectedScheme.description}
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Required Documents
                  </h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {selectedScheme.reqDocs.map((doc, idx) => (
                      <li key={idx} className="text-sm text-foreground">
                        {doc}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="pt-4 flex items-center justify-between border-t border-line">
                  <p className="text-xs text-muted-foreground">
                    Last verified: {selectedScheme.lastVerified}
                  </p>
                  <Button asChild size="sm">
                    <Link to="/assistant">Check Eligibility with Workforce</Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
