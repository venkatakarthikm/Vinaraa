import { create } from 'zustand';

interface SearchState {
  query: string;
  selectedCategory: string;
  selectedLanguage: string;
  results: any;
  setQuery: (q: string) => void;
  setSelectedCategory: (cat: string) => void;
  setSelectedLanguage: (lang: string) => void;
  setResults: (res: any) => void;
  clearSearch: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  selectedCategory: 'All',
  selectedLanguage: 'All',
  results: null,
  setQuery: (query) => set({ query }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setSelectedLanguage: (selectedLanguage) => set({ selectedLanguage }),
  setResults: (results) => set({ results }),
  clearSearch: () => set({ query: '', results: null }),
}));
