import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useAction, useMutation } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import {
  companySizeOptions,
  industryOptions,
  locationOptions,
  subRegions,
  cityOptionsMap,
} from './data';
import {
  buildCompanyResearchCriteria,
  researchCompanies,
  researchCompaniesAction,
} from './companyResearchApi';
import { useSetSelection } from '../shared/useSetSelection';
import type { Company, FilterChipModel, SelectOption } from './types';

/** Persisted shape for an imported company (mirrors the backend validator). */
interface ImportCompanyInput {
  externalId: string;
  name: string;
  domain: string;
  initial: string;
  industry: string;
  location: string;
  size: string;
  techStack: string[];
  confidence: number;
  confidenceTone: Company['confidenceTone'];
}

const importCompaniesMutation = makeFunctionReference<
  'mutation',
  { companies: ImportCompanyInput[] },
  { inserted: number }
>('companies:importCompanies');

/** Which import-result modal to show, if any. */
export type ImportModalState =
  | { kind: 'success'; count: number }
  | { kind: 'warning'; count: number }
  | { kind: 'empty' }
  | null;

interface OutreachContextValue {
  activeNavId: string;
  setActiveNavId: (id: string) => void;
  keywords: string;
  setKeywords: (val: string) => void;
  techStack: string;
  setTechStack: (val: string) => void;
  industry: string;
  setIndustry: (val: string) => void;
  companySize: string;
  setCompanySize: (val: string) => void;
  location: string;
  onLocationChange: (val: string) => void;
  locationOptions: (SelectOption | string)[];
  region: string;
  onRegionChange: (val: string) => void;
  regionOptions: (SelectOption | string)[];
  city: string;
  onCityChange: (val: string) => void;
  cityOptions: (SelectOption | string)[];
  companyLimit: string;
  setCompanyLimit: (val: string) => void;
  chips: FilterChipModel[];
  removeChip: (id: string) => void;
  resultCompanies: Company[];
  matches: number;
  isSearching: boolean;
  searchError: string | undefined;
  selectedIds: Set<string>;
  importToCampaign: () => void;
  /** Which import-result modal to show (success / warning / empty), if any. */
  importModal: ImportModalState;
  dismissImportModal: () => void;
  toggleRow: (id: string) => void;
  toggleAll: () => void;
  clearSelectedResults: () => void;
  reset: () => void;
  search: () => Promise<void>;
}

const OutreachContext = createContext<OutreachContextValue | undefined>(
  undefined,
);

export function OutreachProvider({ children }: { children: ReactNode }) {
  const [activeNavId, setActiveNavId] = useState('companies');
  const [keywords, setKeywords] = useState('');
  const [techStack, setTechStack] = useState('');
  const [industry, setIndustry] = useState('all');
  const [companySize, setCompanySize] = useState('any');
  const [location, setLocation] = useState('Global');
  const [region, setRegion] = useState('all');
  const [city, setCity] = useState('all');
  const [companyLimit, setCompanyLimit] = useState('50');
  const [chips, setChips] = useState<FilterChipModel[]>([]);
  const [resultCompanies, setResultCompanies] = useState<Company[]>([]);
  const [matches, setMatches] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | undefined>();
  const {
    selectedIds,
    clearSelected,
    toggleSelected,
    toggleAll: toggleAllSelected,
  } = useSetSelection<string>();
  const [importModal, setImportModal] = useState<ImportModalState>(null);
  const importCompanies = useMutation(importCompaniesMutation);
  const runResearch = useAction(researchCompaniesAction);

  const dismissImportModal = useCallback(() => setImportModal(null), []);

  const toggleRow = useCallback(
    (id: string) => {
      toggleSelected(id);
    },
    [toggleSelected],
  );

  const toggleAll = useCallback(() => {
    const allSelected =
      resultCompanies.length > 0 &&
      resultCompanies.every((company) => selectedIds.has(company.id));
    toggleAllSelected(
      resultCompanies.map((company) => company.id),
      allSelected,
    );
  }, [resultCompanies, selectedIds, toggleAllSelected]);

  const clearSelectedResults = useCallback(() => {
    setResultCompanies((current) =>
      current.filter((company) => !selectedIds.has(company.id)),
    );
    setMatches((current) => Math.max(current - selectedIds.size, 0));
    clearSelected();
  }, [selectedIds, clearSelected]);

  const importToCampaign = useCallback(async () => {
    const selected = resultCompanies.filter((c) => selectedIds.has(c.id));
    if (selected.length === 0) {
      setImportModal({ kind: 'empty' });
      return;
    }

    // Persist to the pipeline; the mutation upserts (idempotent by externalId)
    // and reports how many were actually new.
    const { inserted } = await importCompanies({
      companies: selected.map((c) => ({
        externalId: c.id,
        name: c.name,
        domain: c.domain,
        initial: c.initial,
        industry: c.industry,
        location: c.location,
        size: c.size,
        techStack: c.techStack,
        confidence: c.confidence,
        confidenceTone: c.confidenceTone,
        ...(c.segment !== undefined ? { segment: c.segment } : {}),
      })),
    });

    setImportModal(
      inserted === 0
        ? { kind: 'warning', count: selected.length }
        : { kind: 'success', count: inserted },
    );
    clearSelectedResults();
  }, [resultCompanies, selectedIds, clearSelectedResults, importCompanies]);

  const removeChip = useCallback((id: string) => {
    setChips((current) => current.filter((chip) => chip.id !== id));
    if (id === 'keywords') setKeywords('');
    if (id === 'techStack') setTechStack('');
    if (id === 'industry') setIndustry('all');
    if (id === 'companySize') setCompanySize('any');
    if (id === 'location') {
      setLocation('Global');
      setRegion('all');
      setCity('all');
    }
    if (id === 'region') {
      setRegion('all');
      setCity('all');
    }
    if (id === 'city') setCity('all');
    if (id === 'companyLimit') setCompanyLimit('50');
  }, []);

  const reset = useCallback(() => {
    setChips([]);
    setKeywords('');
    setTechStack('');
    setIndustry('all');
    setCompanySize('any');
    setLocation('Global');
    setRegion('all');
    setCity('all');
    setCompanyLimit('50');
  }, []);

  const handleLocationChange = useCallback((val: string) => {
    setLocation(val);
    setRegion('all');
    setCity('all');
  }, []);

  const handleRegionChange = useCallback((val: string) => {
    setRegion(val);
    setCity('all');
  }, []);

  const regionOptions = useMemo((): (SelectOption | string)[] => {
    const subList = subRegions[location];
    if (subList) {
      return ['All Regions', ...subList];
    }
    return ['All Regions'];
  }, [location]);

  const cityOptions = useMemo((): (SelectOption | string)[] => {
    if (location !== 'Global' && region !== 'all' && region !== 'All Regions') {
      const key = `${location}, ${region}`;
      const cities = cityOptionsMap[key];
      if (cities) {
        return ['All Cities', ...cities];
      }
    }
    return ['All Cities'];
  }, [location, region]);

  const search = useCallback(async () => {
    setIsSearching(true);
    setSearchError(undefined);

    const nextChips: FilterChipModel[] = [];
    if (keywords.trim()) {
      nextChips.push({ id: 'keywords', label: `Keywords: ${keywords}` });
    }
    if (techStack.trim()) {
      nextChips.push({ id: 'techStack', label: `Tech: ${techStack}` });
    }
    if (industry !== 'all') {
      const label =
        industryOptions.find((o) => o.value === industry)?.label || industry;
      nextChips.push({ id: 'industry', label: `Industry: ${label}` });
    }
    if (companySize !== 'any') {
      const label =
        companySizeOptions.find((o) => o.value === companySize)?.label ||
        companySize;
      nextChips.push({ id: 'companySize', label: `Size: ${label}` });
    }

    let finalLocation = location;
    if (location !== 'Global') {
      if (region !== 'all' && region !== 'All Regions') {
        if (city !== 'all' && city !== 'All Cities') {
          finalLocation = `${location}, ${region}, ${city}`;
        } else {
          finalLocation = `${location}, ${region}`;
        }
      }
      nextChips.push({ id: 'location', label: `Location: ${finalLocation}` });
    }

    if (companyLimit && companyLimit !== '50') {
      nextChips.push({ id: 'companyLimit', label: `Limit: ${companyLimit}` });
    }
    setChips(nextChips);

    try {
      const result = await researchCompanies(
        runResearch,
        buildCompanyResearchCriteria({
          keywords,
          industry,
          companySize,
          location: finalLocation,
          techStack,
          companyLimit,
        }),
      );
      setResultCompanies(result.companies);
      setMatches(result.total);
      clearSelected();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Company research failed';
      setSearchError(message);
    } finally {
      setIsSearching(false);
    }
  }, [
    keywords,
    techStack,
    industry,
    companySize,
    location,
    region,
    city,
    companyLimit,
    clearSelected,
    runResearch,
  ]);

  const value = useMemo(
    () => ({
      activeNavId,
      setActiveNavId,
      keywords,
      setKeywords,
      techStack,
      setTechStack,
      industry,
      setIndustry,
      companySize,
      setCompanySize,
      location,
      onLocationChange: handleLocationChange,
      locationOptions,
      region,
      onRegionChange: handleRegionChange,
      regionOptions,
      city,
      onCityChange: setCity,
      cityOptions,
      companyLimit,
      setCompanyLimit,
      chips,
      removeChip,
      resultCompanies,
      matches,
      isSearching,
      searchError,
      selectedIds,
      importToCampaign,
      importModal,
      dismissImportModal,
      toggleRow,
      toggleAll,
      clearSelectedResults,
      reset,
      search,
    }),
    [
      activeNavId,
      keywords,
      techStack,
      industry,
      companySize,
      location,
      handleLocationChange,
      region,
      handleRegionChange,
      regionOptions,
      city,
      setCity,
      cityOptions,
      companyLimit,
      chips,
      removeChip,
      resultCompanies,
      matches,
      isSearching,
      searchError,
      selectedIds,
      importToCampaign,
      importModal,
      dismissImportModal,
      toggleRow,
      toggleAll,
      clearSelectedResults,
      reset,
      search,
    ],
  );

  return (
    <OutreachContext.Provider value={value}>
      {children}
    </OutreachContext.Provider>
  );
}

export function useOutreachContext() {
  const context = useContext(OutreachContext);
  if (context === undefined) {
    throw new Error(
      'useOutreachContext must be used within an OutreachProvider',
    );
  }
  return context;
}
