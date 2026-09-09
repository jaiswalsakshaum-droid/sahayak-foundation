import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Bot, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { understandCitizenNeed, findRelevantSchemes, type SchemeMatch } from "@/lib/services";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
    <div className="min-h-screen bg-ice-2 text-foreground flex flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ice-2/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-5">
          <Link to="/" className="flex items-center gap-2 mr-6 text-foreground hover:text-brand">
            <span className="grid size-8 place-items-center rounded-lg bg-brand font-display text-sm font-semibold text-primary-foreground">
              S
            </span>
            <span className="font-display font-semibold hidden sm:block">Sahayak</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link to="/assistant" className="text-muted-foreground hover:text-foreground">
              Assistant
            </Link>
            <Link to="/schemes" className="text-foreground">
              Schemes
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-5 py-10">
        <div className="max-w-2xl mb-12">
          <h1 className="text-4xl font-display font-semibold mb-4">Discover Schemes</h1>
          <p className="text-muted-foreground text-lg mb-8">
            Search using natural language, and our Scheme Agent will find the best matches.
          </p>

          <div className="relative flex items-center mb-6">
            <Search className="absolute left-4 size-5 text-muted-foreground" />
            <input
              type="text"
              className="w-full h-14 pl-12 pr-32 rounded-xl border border-line bg-card text-base focus:outline-none focus:ring-2 focus:ring-brand shadow-sm"
              placeholder="e.g. I am looking for a housing scheme..."
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
            <div className="flex flex-wrap gap-2">
              {exampleSearches.map((ex) => (
                <button
                  key={ex}
                  className="px-3 py-1.5 text-xs rounded-full border border-line bg-card hover:border-brand/50 hover:bg-brand/5 transition-colors text-muted-foreground hover:text-foreground"
                  onClick={() => handleSearch(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>

        {isSearching && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="relative mb-6">
              <span className="grid size-12 place-items-center rounded-full bg-brand/10 text-brand">
                <Bot className="size-6 animate-pulse" />
              </span>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-sage ring-2 ring-ice-2">
                <CheckCircle2 className="size-3 text-primary-foreground" />
              </span>
            </div>
            <p className="font-medium text-foreground">
              Scheme Agent is searching the knowledge base...
            </p>
            <p className="text-sm mt-2">Matching your request against 100+ active schemes.</p>
          </div>
        )}

        {!isSearching && hasSearched && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-display font-semibold">
                Found {results.length} schemes
              </h2>
              <Link
                to="/assistant"
                className="text-sm text-brand font-medium hover:underline flex items-center gap-1"
              >
                Check eligibility with Assistant <ArrowRight className="size-4" />
              </Link>
            </div>

            {results.length === 0 ? (
              <div className="text-center py-20 bg-card rounded-xl border border-line">
                <p className="text-muted-foreground">No schemes found for your request.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {results.map((scheme) => (
                  <div
                    key={scheme.id}
                    className="flex flex-col rounded-xl border border-line bg-card p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
                        {scheme.category}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-medium text-sage">
                        <CheckCircle2 className="size-3" /> {scheme.matchScore}% match
                      </span>
                    </div>
                    <h3 className="font-semibold text-lg mb-2 line-clamp-2">{scheme.name}</h3>
                    <p className="text-brand font-medium mb-3 text-sm">{scheme.benefit}</p>
                    <p className="text-sm text-muted-foreground mb-6 flex-1 line-clamp-3">
                      {scheme.description}
                    </p>

                    <Button
                      variant="outline"
                      className="w-full bg-ice-2"
                      onClick={() => setSelectedScheme(scheme)}
                    >
                      View Details
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <Dialog open={!!selectedScheme} onOpenChange={() => setSelectedScheme(null)}>
        <DialogContent className="max-w-2xl">
          {selectedScheme && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl pr-8">{selectedScheme.name}</DialogTitle>
              </DialogHeader>
              <div className="mt-4 space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Benefit
                  </h4>
                  <p className="text-lg font-medium text-brand">{selectedScheme.benefit}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Description
                  </h4>
                  <p className="text-base text-foreground leading-relaxed">
                    {selectedScheme.description}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Required Documents
                  </h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {selectedScheme.reqDocs.map((doc, idx) => (
                      <li key={idx} className="text-base text-foreground">
                        {doc}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="pt-4 flex items-center justify-between border-t border-line">
                  <p className="text-xs text-muted-foreground">
                    Last verified: {selectedScheme.lastVerified}
                  </p>
                  <Link to="/assistant">
                    <Button>Check Eligibility with Workforce</Button>
                  </Link>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
