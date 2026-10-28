import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function NftDetail({ nftId, onBack }: { nftId: string; onBack: () => void }) {
  const { data: nft, isLoading } = useQuery({
    queryKey: ['nft', nftId],
    queryFn: async () => {
      const { data } = await api.get(`/api/nfts/${nftId}`);
      return data;
    },
  });

  if (isLoading) return <div className="p-8 text-center text-[#A89F95]">A carregar detalhes...</div>;
  if (!nft) return <div className="p-8 text-center text-red-400">NFT não encontrada.</div>;

  return (
    <div className="max-w-4xl mx-auto bg-[#1A1512] border border-[#2A2421] rounded-3xl p-8 space-y-6">
      <button onClick={onBack} className="text-sm text-[#E5A93B] hover:underline">
        ← Voltar ao catálogo
      </button>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="aspect-square rounded-2xl overflow-hidden bg-[#221C18]">
          <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
        </div>
        <div className="space-y-4 flex flex-col justify-between">
          <div>
            <span className="text-xs text-[#A89F95]">{nft.collection}</span>
            <h1 className="text-3xl font-black text-[#F3EFEA]">{nft.name}</h1>
            <p className="text-sm text-[#A89F95] mt-2">Edição: {nft.edition}</p>
          </div>
          <div className="border-t border-[#2A2421] pt-4">
            <span className="text-xs text-[#A89F95]">Preço Atual</span>
            <div className="text-3xl font-bold text-[#E5A93B]">{nft.price} ETH</div>
            <button className="w-full mt-4 py-3 rounded-xl bg-[#E5A93B] text-black font-bold hover:bg-[#d49933] transition-all">
              Comprar NFT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}