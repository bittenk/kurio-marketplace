import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface CartItem {
  id: string;
  nftId: string;
  name: string;
  price: string;
  image: string;
  edition: string;
  quantity: number;
}

export function useCart() {
  const queryClient = useQueryClient();

  const { data: cart = [], isLoading } = useQuery<CartItem[]>({
    queryKey: ['cart'],
    queryFn: async () => {
      const { data } = await api.get('/api/cart');
      return data;
    },
  });

  const addToCart = useMutation({
    mutationFn: async (nftId: string) => {
      const { data } = await api.post('/api/cart', { nftId, quantity: 1 });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  const removeFromCart = useMutation({
    mutationFn: async (itemId: string) => {
      await api.delete(`/api/cart/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  return { cart, isLoading, addToCart, removeFromCart };
}