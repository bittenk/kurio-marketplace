import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

export function useRealtimeUpdates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = io('/', { path: '/socket.io' });

    socket.on('nft.updated', () => {
      queryClient.invalidateQueries({ queryKey: ['nfts'] });
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    });

    socket.on('order.updated', (orderData) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      console.log('Pedido atualizado em tempo real:', orderData);
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);
}