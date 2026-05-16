import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, X } from "lucide-react";
import { searchApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/types";

interface Props {
  onSelect: (result: SearchResult) => void;
  segment?: "EQ" | "MF";
  placeholder?: string;
  className?: string;
  clearOnSelect?: boolean;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function InstrumentSearch({ onSelect, segment, placeholder = "Search stocks...", className, clearOnSelect = true }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  const type = segment === "MF" ? "mf" : "stock";

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    searchApi.search(debouncedQuery, type)
      .then((r) => { setResults(r); setOpen(true); setActiveIdx(0); })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery, type]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = useCallback((r: SearchResult) => {
    onSelect(r);
    if (clearOnSelect) setQuery("");
    setOpen(false);
  }, [onSelect, clearOnSelect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[activeIdx]) { handleSelect(results[activeIdx]); }
    if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative flex items-center">
        {loading ? (
          <Loader2 className="absolute left-3 w-4 h-4 text-slate-400 animate-spin" />
        ) : (
          <Search className="absolute left-3 w-4 h-4 text-slate-400" />
        )}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2.5 bg-[#1A2236] border border-[#1E293B] rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
          aria-label="Search instruments"
          aria-expanded={open}
          role="combobox"
        />
        {query && (
          <button onClick={() => { setQuery(""); setResults([]); setOpen(false); }} className="absolute right-3 text-slate-500 hover:text-slate-300">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1A2236] border border-[#1E293B] rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto scrollbar-hide">
          {results.map((r, i) => (
            <button
              key={r.id}
              onMouseDown={() => handleSelect(r)}
              onMouseEnter={() => setActiveIdx(i)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#1F2D45] transition-colors",
                i === activeIdx && "bg-[#1F2D45]"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-100 tabular-nums">{r.symbol}</span>
                  {r.exchange && (
                    <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", r.exchange === "NSE" ? "bg-orange-500/20 text-orange-400" : "bg-sky-500/20 text-sky-400")}>
                      {r.exchange}
                    </span>
                  )}
                  {r.instrument_type === "MF" && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium">MF</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">{r.name}</p>
              </div>
              {(r.sector || r.category) && (
                <span className="text-xs text-slate-500 shrink-0">{r.sector ?? r.category}</span>
              )}
              {r.cap_category && (
                <span className="text-xs text-slate-600 shrink-0">{r.cap_category}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {open && !loading && results.length === 0 && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1A2236] border border-[#1E293B] rounded-xl shadow-xl z-50 px-4 py-6 text-center text-slate-400 text-sm">
          No results for "{query}"
        </div>
      )}
    </div>
  );
}
