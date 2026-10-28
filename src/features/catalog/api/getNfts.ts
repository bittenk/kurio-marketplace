import { api } from '@/lib/api';

export interface NftItem {
  id: string;
  name: string;
  collection: string;
  price: string;
  image: string;
  rarity?: string;
  edition: string;
}

export async function getNfts(params?: { search?: string; category?: string }): Promise<NftItem[]> {
  // Chamada simulada que o MSW vai interceptar
  const response = await api.get('/api/nfts', { params });
  return response.data;
}