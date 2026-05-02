import { createContext, useContext, useState, ReactNode } from "react";

type SearchContextType = {
  searchVisible: boolean;
  toggleSearch: () => void;
  query: string;
  setQuery: (q: string) => void;
};

const SearchContext = createContext<SearchContextType | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [searchVisible, setSearchVisible] = useState(false);
  const [query, setQuery] = useState("");

  const toggleSearch = () => {
    setSearchVisible((v) => {
      if (v) setQuery("");
      return !v;
    });
  };

  return (
    <SearchContext.Provider value={{ searchVisible, toggleSearch, query, setQuery }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used within SearchProvider");
  return ctx;
}
