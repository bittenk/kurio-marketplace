import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface NftFilters {
  search?: string;
  category?: string;
  sort?: string;
  minPrice?: string;
  maxPrice?: string;
}

export function useNfts(filters?: NftFilters) {
  return useQuery({
    queryKey: ['nfts', filters],
    queryFn: async () => {
      const { data } = await api.get('/api/nfts', { params: filters });
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}