import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Filter,
  CheckCircle2,
  ChevronRight,
  X,
  ExternalLink,
  Bot,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MOCK_SCHEMES_DATA } from "@/lib/admin-services";

import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin/schemes")({
  beforeLoad: async () => {
    await requireAuth();
  },
  component: AdminSchemesPage,
});

const FILTERS = [
  "Central",
  "State",
  "Education",
  "Agriculture",
  "Employment",
  "Women",
  "Health",
  "Housing",
];

function AdminSchemesPage() {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedScheme, setSelectedScheme] = useState<(typeof MOCK_SCHEMES_DATA)[0] | null>(null);

  const toggleFilter = (filter: string) => {
    setActiveFilters((prev) =>
      prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter],
    );
  };

  const filteredSchemes = MOCK_SCHEMES_DATA.filter((scheme) => {
    const matchesSearch = scheme.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilters =
      activeFilters.length === 0 ||
      activeFilters.some((f) => scheme.jurisdiction === f || scheme.category === f);
    return matchesSearch && matchesFilters;
  });

  return (
    <div className="min-h-screen bg-ice-2 text-foreground flex flex-col overflow-hidden">
      <header className="sticky top-0 z-30 border-b border-line bg-ice-2/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full items-center px-5">
          <Link to="/" className="flex items-center gap-2 mr-8 text-foreground hover:text-brand">
            <span className="grid size-8 place-items-center rounded-lg bg-slate-900 font-display text-sm font-semibold text-white">
              S
            </span>
            <span className="font-display font-semibold hidden sm:block">Sahayak Admin</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link to="/admin" className="text-muted-foreground hover:text-foreground">
              Overview
            </Link>
            <Link to="/admin/agents" className="text-muted-foreground hover:text-foreground">
              AI Workforce
            </Link>
            <Link to="/admin/schemes" className="text-foreground">
              Knowledge Base
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full px-5 py-8 mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-semibold mb-2">Scheme Knowledge Base</h1>
            <p className="text-muted-foreground">
              Manage the structured government schemes dataset used by Sahayak.
            </p>
          </div>
          <Button onClick={() => toast("Scheme addition is disabled in demo mode.")}>
            Add Scheme
          </Button>
        </div>

        <div className="bg-card rounded-xl border border-line shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-line flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-ice-2/50">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search schemes..."
                className="w-full pl-9 pr-4 py-2 bg-card border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="size-4 text-muted-foreground mr-1" />
              {FILTERS.map((filter) => (
                <button
                  key={filter}
                  onClick={() => toggleFilter(filter)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${activeFilters.includes(filter) ? "bg-slate-900 text-white border-slate-900" : "bg-card text-muted-foreground border-line hover:border-slate-400"}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-ice-2 text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">Scheme</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Jurisdiction</th>
                  <th className="px-6 py-4 font-medium">Eligibility Rules</th>
                  <th className="px-6 py-4 font-medium">Required Docs</th>
                  <th className="px-6 py-4 font-medium">Source / Sync</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-card">
                {filteredSchemes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                      No schemes found matching the filters.
                    </td>
                  </tr>
                ) : (
                  filteredSchemes.map((scheme) => (
                    <tr
                      key={scheme.id}
                      className="hover:bg-ice-2/50 transition-colors group cursor-pointer"
                      onClick={() => setSelectedScheme(scheme)}
                    >
                      <td className="px-6 py-4 font-medium">{scheme.name}</td>
                      <td className="px-6 py-4 text-muted-foreground">{scheme.category}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${scheme.jurisdiction === "Central" ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"}`}
                        >
                          {scheme.jurisdiction}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 text-sage font-medium">
                          <CheckCircle2 className="size-3.5" /> Mapped
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{scheme.docs} docs</td>
                      <td className="px-6 py-4">
                        <div className="text-xs">
                          <p className="font-medium text-foreground">{scheme.official_source}</p>
                          <p className="text-muted-foreground">{scheme.last_verified}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          {scheme.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Side Drawer for Scheme Details */}
      {selectedScheme && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg h-full bg-card border-l border-line shadow-2xl flex flex-col animate-in slide-in-from-right-full duration-300">
            <div className="p-6 border-b border-line flex items-center justify-between bg-ice-2">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                  Scheme Knowledge Graph
                </span>
                <h2 className="font-display font-semibold text-lg">{selectedScheme.name}</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedScheme(null)}>
                <X className="size-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-ice-2 rounded-xl border border-line">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Source
                  </p>
                  <p className="font-medium flex items-center gap-2">
                    {selectedScheme.official_source}{" "}
                    <ExternalLink className="size-3 text-muted-foreground" />
                  </p>
                </div>
                <div className="p-4 bg-ice-2 rounded-xl border border-line">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Data Health
                  </p>
                  <p className="font-medium text-sage flex items-center gap-1.5">
                    <CheckCircle2 className="size-4" /> Synced {selectedScheme.last_verified}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3 border-b border-line pb-2 flex items-center justify-between">
                  Structured Eligibility Rules
                  <span className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded font-mono">
                    Mapped
                  </span>
                </h4>
                <div className="space-y-3">
                  <div className="flex items-start justify-between p-3 border border-line rounded-lg text-sm bg-card shadow-sm">
                    <div>
                      <p className="font-medium">Age Requirement</p>
                      <p className="text-muted-foreground text-xs font-mono mt-1">
                        type: numeric_range | source: citizen_profile
                      </p>
                    </div>
                    <span className="font-medium bg-ice-2 px-2 py-1 rounded">18 - 25 years</span>
                  </div>
                  <div className="flex items-start justify-between p-3 border border-line rounded-lg text-sm bg-card shadow-sm">
                    <div>
                      <p className="font-medium">Household Income</p>
                      <p className="text-muted-foreground text-xs font-mono mt-1">
                        type: numeric_max | source: income_certificate
                      </p>
                    </div>
                    <span className="font-medium bg-ice-2 px-2 py-1 rounded">≤ ₹3,00,000</span>
                  </div>
                  <div className="flex items-start justify-between p-3 border border-line rounded-lg text-sm bg-card shadow-sm">
                    <div>
                      <p className="font-medium">Education Level</p>
                      <p className="text-muted-foreground text-xs font-mono mt-1">
                        type: enum | source: citizen_profile
                      </p>
                    </div>
                    <span className="font-medium bg-ice-2 px-2 py-1 rounded">Undergraduate</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3 border-b border-line pb-2 flex items-center justify-between">
                  Required Documents
                  <span className="text-xs bg-amber/10 text-amber px-2 py-0.5 rounded flex items-center gap-1">
                    <AlertTriangle className="size-3" /> Hard Constraint
                  </span>
                </h4>
                <div className="space-y-2">
                  <div className="p-3 border border-line rounded-lg text-sm bg-card shadow-sm flex items-center justify-between">
                    <span className="font-medium">Income Certificate</span>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      Mandatory
                    </span>
                  </div>
                  <div className="p-3 border border-line rounded-lg text-sm bg-card shadow-sm flex items-center justify-between">
                    <span className="font-medium">Enrollment Certificate</span>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      Mandatory
                    </span>
                  </div>
                  <div className="p-3 border border-line rounded-lg text-sm bg-card shadow-sm flex items-center justify-between">
                    <span className="font-medium">Identity Proof (Aadhaar/PAN)</span>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      Mandatory
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-brand/5 p-4 rounded-xl border border-brand/20 flex gap-3 text-brand">
                <Bot className="size-5 shrink-0" />
                <p className="text-sm">
                  This scheme is fully structured and can be autonomously evaluated by the Sahayak
                  AI Workforce.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
