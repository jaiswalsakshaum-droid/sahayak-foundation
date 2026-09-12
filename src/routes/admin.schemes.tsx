import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Loader2,
  RefreshCw,
  FileCheck,
  Plus,
  Landmark,
  Shield,
  Layers,
  FileText,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { requireAdmin } from "@/lib/auth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  getAdminSchemes,
  updateAdminSchemeStatus,
  createAdminScheme,
  type AdminSchemeDetail,
} from "@/lib/admin-services";

export const Route = createFileRoute("/admin/schemes")({
  beforeLoad: async () => {
    await requireAdmin();
  },
  head: () => ({
    meta: [
      { title: "Schemes Catalog Management — Sahayak Admin" },
      {
        name: "description",
        content: "Manage national welfare scheme repository, update eligibility criteria, and register new government programs.",
      },
    ],
  }),
  component: AdminSchemesPage,
});

const CATEGORIES = [
  "Central",
  "State",
  "Education",
  "Agriculture",
  "Employment & Pension",
  "Women & Child",
  "Healthcare",
  "Housing",
  "Business & Loans",
];

function AdminSchemesPage() {
  const queryClient = useQueryClient();
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedScheme, setSelectedScheme] = useState<AdminSchemeDetail | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // New Scheme Form State
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Education");
  const [newJurisdiction, setNewJurisdiction] = useState<"Central" | "State">("Central");
  const [newBenefit, setNewBenefit] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSource, setNewSource] = useState("myScheme / National Portal");
  const [newRules, setNewRules] = useState<{ criterion_name: string; requirement: string; rule_type: string }[]>([
    { criterion_name: "Citizenship & Identification", requirement: "Valid Aadhaar card holder", rule_type: "text" },
  ]);
  const [newDocs, setNewDocs] = useState<{ document_type: string; is_mandatory: boolean }[]>([
    { document_type: "Aadhaar Card", is_mandatory: true },
  ]);

  // Query
  const {
    data: schemes = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["admin", "schemes"],
    queryFn: getAdminSchemes,
  });

  // Status Update Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "Active" | "Draft" | "Archived";
    }) => {
      const res = await updateAdminSchemeStatus(id, status);
      if (!res.ok) throw new Error(res.error);
      return { id, status };
    },
    onSuccess: (data) => {
      toast.success(`Scheme status updated to ${data.status}`, {
        description: `Changes persisted to DB and updated in live AI agent search.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "schemes"] });
      if (selectedScheme && selectedScheme.id === data.id) {
        setSelectedScheme((prev) =>
          prev ? { ...prev, eligibility_status: data.status, status: data.status } : null,
        );
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update scheme status");
    },
  });

  // Create Scheme Mutation
  const createSchemeMutation = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error("Scheme name is required.");
      const res = await createAdminScheme({
        name: newName.trim(),
        category: newCategory,
        jurisdiction: newJurisdiction,
        benefit: newBenefit.trim(),
        description: newDescription.trim(),
        official_source: newSource.trim(),
        rules: newRules,
        documents: newDocs,
      });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      toast.success("New Scheme Registered", {
        description: "Scheme registered in database and available for AI agent recommendations.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "schemes"] });
      setIsCreateOpen(false);
      resetNewForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create scheme");
    },
  });

  const resetNewForm = () => {
    setNewName("");
    setNewCategory("Education");
    setNewJurisdiction("Central");
    setNewBenefit("");
    setNewDescription("");
    setNewSource("myScheme / National Portal");
    setNewRules([{ criterion_name: "Citizenship & Identification", requirement: "Valid Aadhaar card holder", rule_type: "text" }]);
    setNewDocs([{ document_type: "Aadhaar Card", is_mandatory: true }]);
  };

  const toggleFilter = (filter: string) => {
    setActiveFilters((prev) =>
      prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter],
    );
  };

  const filteredSchemes = schemes.filter((scheme) => {
    const matchesSearch =
      scheme.name.toLowerCase().includes(search.toLowerCase()) ||
      scheme.category.toLowerCase().includes(search.toLowerCase()) ||
      (scheme.description || "").toLowerCase().includes(search.toLowerCase());
    const matchesFilters =
      activeFilters.length === 0 ||
      activeFilters.some((f) => scheme.jurisdiction === f || scheme.category === f);
    return matchesSearch && matchesFilters;
  });

  return (
    <AdminLayout
      title="National Schemes Management"
      subtitle="Supervise scheme eligibility rules, document requirements, and status propagation to AI agents."
    >
      <div className="space-y-6">
        {/* Top Controls Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex flex-wrap items-center gap-2 flex-1 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              <Input
                placeholder="Search scheme name, category, or benefit..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 pl-8 text-xs h-9"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 h-9 text-xs"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${isRefetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="bg-brand hover:bg-brand/90 text-white font-medium text-xs h-9 shadow-md shadow-brand/20 flex items-center gap-1.5 shrink-0"
          >
            <Plus className="size-4" />
            Add New Scheme
          </Button>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500 font-medium mr-1">Filter:</span>
          {CATEGORIES.map((cat) => {
            const isSelected = activeFilters.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleFilter(cat)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-brand text-white shadow-sm"
                    : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
                }`}
              >
                {cat}
              </button>
            );
          })}
          {activeFilters.length > 0 && (
            <button
              onClick={() => setActiveFilters([])}
              className="text-xs text-slate-400 hover:text-slate-200 underline ml-2"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Schemes Table / Cards */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
            <Loader2 className="size-7 animate-spin text-brand" />
            <p className="text-xs">Loading live schemes from database...</p>
          </div>
        ) : filteredSchemes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center">
            <Landmark className="size-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">No Schemes Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              No government schemes match the active search or category filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSchemes.map((scheme) => (
              <div
                key={scheme.id}
                className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Category & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
                        {scheme.jurisdiction}
                      </span>
                      <span className="rounded bg-indigo-950/80 border border-indigo-800/60 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                        {scheme.category}
                      </span>
                    </div>

                    <select
                      value={scheme.eligibility_status}
                      disabled={updateStatusMutation.isPending}
                      onChange={(e) => {
                        updateStatusMutation.mutate({
                          id: scheme.id,
                          status: e.target.value as "Active" | "Draft" | "Archived",
                        });
                      }}
                      className={`rounded px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider bg-slate-950 focus:outline-none ${
                        scheme.eligibility_status === "Active"
                          ? "text-emerald-300 border-emerald-800"
                          : scheme.eligibility_status === "Draft"
                          ? "text-amber-300 border-amber-800"
                          : "text-slate-400 border-slate-700"
                      }`}
                    >
                      <option value="Active">Active</option>
                      <option value="Draft">Draft</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-sm font-bold text-white leading-snug">{scheme.name}</h3>
                    {scheme.benefit && (
                      <p className="text-xs font-semibold text-brand mt-1">{scheme.benefit}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {scheme.description || "Official government welfare program."}
                    </p>
                  </div>

                  {/* Requirements Quick Counters */}
                  <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                    <span className="flex items-center gap-1">
                      <Layers className="size-3.5 text-indigo-400" />
                      {scheme.eligibility_rules?.length || 0} Rules
                    </span>
                    <span className="flex items-center gap-1">
                      <FileCheck className="size-3.5 text-emerald-400" />
                      {scheme.document_requirements?.length || scheme.docs || 0} Documents
                    </span>
                  </div>
                </div>

                {/* View Details Button */}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedScheme(scheme)}
                    className="w-full border-slate-700 bg-slate-950/80 text-slate-200 hover:bg-slate-800 h-8 text-xs font-medium flex items-center justify-center gap-1"
                  >
                    View Detailed Rules & Docs
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scheme Detail Dialog */}
      <Dialog open={Boolean(selectedScheme)} onOpenChange={(open) => !open && setSelectedScheme(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-xl max-h-[85vh] overflow-y-auto">
          {selectedScheme && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded bg-brand/20 border border-brand/30 px-2 py-0.5 text-[10px] font-semibold text-brand uppercase">
                    {selectedScheme.jurisdiction}
                  </span>
                  <span className="rounded bg-indigo-950 border border-indigo-800 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                    {selectedScheme.category}
                  </span>
                </div>
                <DialogTitle className="text-lg font-bold text-white font-display">
                  {selectedScheme.name}
                </DialogTitle>
                {selectedScheme.benefit && (
                  <DialogDescription className="text-xs font-semibold text-brand">
                    {selectedScheme.benefit}
                  </DialogDescription>
                )}
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                <div>
                  <h4 className="font-semibold text-slate-300 mb-1">Description</h4>
                  <p className="text-slate-400 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                    {selectedScheme.description || "No description provided."}
                  </p>
                </div>

                {/* Eligibility Rules */}
                <div>
                  <h4 className="font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Layers className="size-3.5 text-indigo-400" />
                    Structured Deterministic Eligibility Rules
                  </h4>
                  <div className="space-y-1.5">
                    {selectedScheme.eligibility_rules?.length ? (
                      selectedScheme.eligibility_rules.map((rule, idx) => (
                        <div
                          key={rule.id || idx}
                          className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800 flex items-start justify-between gap-2"
                        >
                          <div>
                            <p className="font-bold text-slate-200">{rule.criterion_name}</p>
                            <p className="text-slate-400 text-[11px] mt-0.5">{rule.requirement}</p>
                          </div>
                          {rule.evidence_source && (
                            <span className="rounded bg-slate-900 border border-slate-700 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 shrink-0">
                              {rule.evidence_source}
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 italic">No structured rules configured.</p>
                    )}
                  </div>
                </div>

                {/* Document Requirements */}
                <div>
                  <h4 className="font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <FileCheck className="size-3.5 text-emerald-400" />
                    Mandatory & Supporting Documents
                  </h4>
                  <div className="space-y-1.5">
                    {selectedScheme.document_requirements?.length ? (
                      selectedScheme.document_requirements.map((doc, idx) => (
                        <div
                          key={doc.id || idx}
                          className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800 flex items-center justify-between"
                        >
                          <span className="font-medium text-slate-200">{doc.document_type}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              doc.is_mandatory
                                ? "bg-rose-950/80 text-rose-300 border border-rose-800"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {doc.is_mandatory ? "Mandatory" : "Optional"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 italic">No document requirements defined.</p>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  size="sm"
                  onClick={() => setSelectedScheme(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-white"
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add New Scheme Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2 font-display">
              <Plus className="size-5 text-brand" />
              Register New Government Scheme
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Create an official scheme record with eligibility rules and mandatory document requirements.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Scheme Official Name *</label>
              <Input
                placeholder="e.g., PM Surya Ghar: Muft Bijli Yojana"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-slate-950 border-slate-700 text-white text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  {CATEGORIES.filter((c) => c !== "Central" && c !== "State").map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Jurisdiction</label>
                <select
                  value={newJurisdiction}
                  onChange={(e) => setNewJurisdiction(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="Central">Central (National)</option>
                  <option value="State">State Government</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Quantified Benefit</label>
              <Input
                placeholder="e.g., ₹78,000 direct subsidy for rooftop solar"
                value={newBenefit}
                onChange={(e) => setNewBenefit(e.target.value)}
                className="bg-slate-950 border-slate-700 text-white text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Description</label>
              <Textarea
                placeholder="Provide a summary of objectives, beneficiaries, and subsidy details..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="bg-slate-950 border-slate-700 text-white text-xs min-h-[60px]"
              />
            </div>

            {/* Rules Section */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-300">Eligibility Criteria</label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setNewRules([
                      ...newRules,
                      { criterion_name: "Annual Income", requirement: "Income under ₹3,00,000", rule_type: "numeric" },
                    ])
                  }
                  className="h-7 text-[11px] text-brand hover:text-brand"
                >
                  + Add Rule
                </Button>
              </div>
              {newRules.map((rule, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="Criterion"
                    value={rule.criterion_name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewRules((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, criterion_name: val } : r)),
                      );
                    }}
                    className="bg-slate-950 border-slate-700 text-xs h-8 flex-1"
                  />
                  <Input
                    placeholder="Requirement"
                    value={rule.requirement}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewRules((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, requirement: val } : r)),
                      );
                    }}
                    className="bg-slate-950 border-slate-700 text-xs h-8 flex-1"
                  />
                  {newRules.length > 1 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setNewRules((prev) => prev.filter((_, i) => i !== idx))}
                      className="size-7 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Documents Section */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-300">Required Documents</label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setNewDocs([
                      ...newDocs,
                      { document_type: "Income Certificate", is_mandatory: true },
                    ])
                  }
                  className="h-7 text-[11px] text-brand hover:text-brand"
                >
                  + Add Document
                </Button>
              </div>
              {newDocs.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="Document Name (e.g. Electricity Bill)"
                    value={doc.document_type}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewDocs((prev) =>
                        prev.map((d, i) => (i === idx ? { ...d, document_type: val } : d)),
                      );
                    }}
                    className="bg-slate-950 border-slate-700 text-xs h-8 flex-1"
                  />
                  {newDocs.length > 1 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setNewDocs((prev) => prev.filter((_, i) => i !== idx))}
                      className="size-7 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              disabled={createSchemeMutation.isPending}
              onClick={() => setIsCreateOpen(false)}
              className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={createSchemeMutation.isPending}
              onClick={() => createSchemeMutation.mutate()}
              className="bg-brand hover:bg-brand/90 text-white font-medium"
            >
              {createSchemeMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Saving to DB...
                </>
              ) : (
                <>
                  <Save className="size-3.5 mr-1.5" />
                  Create Scheme
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
