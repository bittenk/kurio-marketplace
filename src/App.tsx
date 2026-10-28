import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, useEffect } from 'react'
import { api } from './lib/api'
import { io } from 'socket.io-client'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
})

interface NftItem {
  id: string;
  name: string;
  collection: string;
  price: string;
  image: string;
  edition: string;
}

interface CartItem {
  id: string;
  name: string;
  image: string;
  price: string;
  quantity: number;
}

const FALLBACK_NFTS: NftItem[] = [
  { id: '1', name: 'Macaco Esmeralda #042', collection: 'Edições Kurio', price: '1,19 ETH', image: '/assets/nfts/emerald-ape.png', edition: '1/50' },
  { id: '2', name: 'Sábio Nômade #009', collection: 'Edições Kurio', price: '1,69 ETH', image: '/assets/nfts/sage-nomad.png', edition: '1/20' },
  { id: '3', name: 'Vaso de néon nº 552', collection: 'Edições Kurio', price: '1,99 ETH', image: '/assets/nfts/neon-vessel.png', edition: '1/100' },
  { id: '4', name: 'Desabrochar Cósmico #118', collection: 'Edições Kurio', price: '1,29 ETH', image: '/assets/nfts/cosmic-bloom.png', edition: '1/75' },
  { id: '5', name: 'Violet Nomad #314', collection: 'Edições Kurio', price: '1,39 ETH', image: '/assets/nfts/sage-nomad.png', edition: '1/30' },
  { id: '6', name: 'Ivory Baron #888', collection: 'Edições Kurio', price: '1,79 ETH', image: '/assets/nfts/neon-vessel.png', edition: '1/10' },
]

function MainApp() {
  const [currentView, setCurrentView] = useState<'home' | 'cart' | 'checkout' | 'profile' | 'detail'>('home')
  const [selectedNftId, setSelectedNftId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    const socket = io('/', { path: '/socket.io' })
    socket.on('nft.updated', () => {
      queryClient.invalidateQueries({ queryKey: ['nfts'] })
    })
    return () => {
      socket.disconnect()
    }
  }, [queryClient])

  const { data: nfts = FALLBACK_NFTS } = useQuery<NftItem[]>({
    queryKey: ['nfts'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/api/nfts')
        return Array.isArray(data) && data.length > 0 ? data : FALLBACK_NFTS
      } catch {
        return FALLBACK_NFTS
      }
    },
  })

  const { data: cart = [] } = useQuery<CartItem[]>({
    queryKey: ['cart'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/api/cart')
        return Array.isArray(data) ? data : []
      } catch {
        return []
      }
    },
  })

  const addToCartMutation = useMutation({
    mutationFn: async (nftId: string) => {
      await api.post('/api/cart', { nftId, quantity: 1 })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      setCurrentView('cart')
    }
  })

  return (
    <div className="min-h-screen bg-[#120F0D] text-[#F3EFEA] font-sans antialiased selection:bg-[#E5A93B] selection:text-black" translate="no">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#2A2421] bg-[#120F0D]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <span className="text-2xl font-black tracking-wider text-[#E5A93B] cursor-pointer" onClick={() => { setCurrentView('home'); setSelectedNftId(null); }}>
              KURIO
            </span>
            <nav className="hidden md:flex items-center gap-8 text-sm text-[#A89F95]">
              <button onClick={() => { setCurrentView('home'); setSelectedNftId(null); }} className="text-white font-medium transition-colors">Início</button>
              <button className="hover:text-white transition-colors">Mercado</button>
              <button className="hover:text-white transition-colors">Criadores</button>
              <button className="hover:text-white transition-colors">Aprenda</button>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setCurrentView('cart')}
              className="px-4 py-2 rounded-xl bg-[#1A1512] border border-[#3A312B] text-sm hover:border-[#E5A93B] transition-all relative flex items-center gap-2"
            >
              <span>🛒 Carrinho</span> {cart.length > 0 && <span className="bg-[#E5A93B] text-black text-xs font-bold px-1.5 py-0.2 rounded-full">{cart.length}</span>}
            </button>
            <button 
              onClick={() => setCurrentView('profile')}
              className="px-5 py-2 rounded-xl bg-[#E5A93B] text-black font-semibold text-sm hover:bg-[#d49933] transition-all shadow-lg shadow-[#E5A93B]/10"
            >
              Entrar
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-16">
        {currentView === 'home' && (
          <div className="space-y-16">
            {/* Hero Banner Principal */}
            <div className="relative rounded-3xl bg-[#1A1512] p-8 md:p-12 border border-[#3A312B] overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-4 max-w-xl">
                <span className="text-xs font-semibold tracking-widest text-[#E5A93B] uppercase">Bem-vindo à Kurio</span>
                <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
                  SEJA DONO DO FUTURO<br />DA ARTE DIGITAL
                </h1>
                <p className="text-[#A89F95] text-sm md:text-base leading-relaxed">
                  Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.
                </p>
                <div className="pt-2">
                  <button className="px-6 py-3 rounded-xl bg-[#E5A93B] text-black font-bold hover:bg-[#d49933] transition-all shadow-lg shadow-[#E5A93B]/10">
                    Explorar 🔥
                  </button>
                </div>
              </div>
              <div className="w-64 h-64 md:w-80 md:h-80 rounded-2xl bg-[#120F0D] border border-[#3A312B] flex items-center justify-center overflow-hidden shadow-2xl">
                <img src="/assets/nfts/emerald-ape.png" alt="Emerald Ape" className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Layout Principal: Filtros à Esquerda e Grelha à Direita */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Barra Lateral / Filtros */}
              <div className="space-y-8 bg-[#1A1512] p-6 rounded-3xl border border-[#3A312B] h-fit">
                <div>
                  <h3 className="font-bold text-base mb-4 text-[#F3EFEA]">Coleções</h3>
                  <ul className="space-y-2.5 text-xs text-[#A89F95]">
                    <li className="flex justify-between hover:text-white cursor-pointer"><span>Arte digital</span><span>(33)</span></li>
                    <li className="flex justify-between hover:text-white cursor-pointer"><span>Fotografia</span><span>(12)</span></li>
                    <li className="flex justify-between hover:text-white cursor-pointer"><span>Música</span><span>(65)</span></li>
                    <li className="flex justify-between hover:text-white cursor-pointer"><span>Arte 3D</span><span>(39)</span></li>
                    <li className="flex justify-between hover:text-white cursor-pointer"><span>Colecionáveis</span><span>(23)</span></li>
                    <li className="flex justify-between hover:text-white cursor-pointer"><span>Generativa</span><span>(17)</span></li>
                    <li className="flex justify-between hover:text-white cursor-pointer"><span>Jogos</span><span>(19)</span></li>
                    <li className="flex justify-between hover:text-white cursor-pointer"><span>Assinaturas</span><span>(13)</span></li>
                    <li className="flex justify-between hover:text-white cursor-pointer"><span>Utilidade</span><span>(18)</span></li>
                  </ul>
                </div>

                <div className="border-t border-[#2A2421] pt-6">
                  <h3 className="font-bold text-base mb-3 text-[#F3EFEA]">Faixa de preço</h3>
                  <div className="space-y-3">
                    <input type="range" className="w-full accent-[#E5A93B]" />
                    <div className="flex justify-between text-xs text-[#A89F95]">
                      <span>Preço: 0,02 - 12,38 ETH</span>
                    </div>
                    <button className="w-full py-2 rounded-xl bg-[#2A2421] hover:bg-[#E5A93B] hover:text-black font-semibold text-xs transition-all">
                      Aplicar
                    </button>
                  </div>
                </div>

                <div className="border-t border-[#2A2421] pt-6">
                  <h3 className="font-bold text-base mb-4 text-[#F3EFEA]">Rede</h3>
                  <ul className="space-y-2.5 text-xs text-[#A89F95]">
                    <li className="flex justify-between hover:text-white cursor-pointer"><span>Ethereum</span><span>(119)</span></li>
                    <li className="flex justify-between hover:text-white cursor-pointer"><span>Polygon</span><span>(78)</span></li>
                    <li className="flex justify-between hover:text-white cursor-pointer"><span>Solana</span><span>(86)</span></li>
                  </ul>
                </div>

                {/* Seção NFT em Destaque */}
                <div className="border-t border-[#2A2421] pt-6 space-y-4">
                  <h3 className="font-bold text-sm text-[#E5A93B] uppercase tracking-wider">NFT EM DESTAQUE</h3>
                  <p className="text-xs text-[#A89F95]">OFERTA LIMITADA</p>
                  <div className="bg-[#120F0D] rounded-2xl p-3 border border-[#3A312B] overflow-hidden">
                    <img src="/assets/nfts/sage-nomad.png" className="w-full aspect-square object-cover rounded-xl mb-3" alt="Destaque" />
                    <span className="font-bold text-sm block">Sage Nomad #009</span>
                    <span className="text-xs text-[#E5A93B]">1.69 ETH</span>
                  </div>
                </div>
              </div>

              {/* Grelha de NFTs Principal */}
              <div className="lg:col-span-3 space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#1A1512] p-4 rounded-2xl border border-[#3A312B]">
                  <div className="flex items-center gap-6 text-xs font-semibold text-[#A89F95]">
                    <button className="text-white border-b-2 border-[#E5A93B] pb-1">Todos os NFTs</button>
                    <button className="hover:text-white transition-colors">Novos lançamentos</button>
                    <button className="hover:text-white transition-colors">Em alta</button>
                  </div>
                  <span className="text-xs text-[#A89F95]">Ordenar por: Listados recentemente</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {nfts.map((nft) => (
                    <div key={nft.id} className="bg-[#1A1512] border border-[#2A2421] rounded-2xl p-4 hover:border-[#E5A93B]/50 transition-all group">
                      <div 
                        className="aspect-square rounded-xl overflow-hidden bg-[#221C18] mb-4 cursor-pointer relative"
                        onClick={() => { setSelectedNftId(nft.id); setCurrentView('detail'); }}
                      >
                        <img src={nft.image} alt={nft.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                      <h3 className="font-bold text-sm mb-1 cursor-pointer hover:text-[#E5A93B]" onClick={() => { setSelectedNftId(nft.id); setCurrentView('detail'); }}>
                        {nft.name}
                      </h3>
                      <p className="text-xs text-[#A89F95] mb-3">{nft.collection}</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs text-[#A89F95] block">Preço</span>
                          <span className="font-bold text-[#E5A93B] text-sm">{nft.price}</span>
                        </div>
                        <button 
                          onClick={() => addToCartMutation.mutate(nft.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#2A2421] hover:bg-[#E5A93B] hover:text-black text-xs font-semibold transition-all"
                        >
                          Comprar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Paginação */}
                <div className="flex justify-center items-center gap-2 pt-6">
                  <button className="w-8 h-8 rounded-lg bg-[#E5A93B] text-black font-bold text-xs">1</button>
                  <button className="w-8 h-8 rounded-lg bg-[#1A1512] border border-[#3A312B] text-xs hover:border-[#E5A93B]">2</button>
                  <button className="w-8 h-8 rounded-lg bg-[#1A1512] border border-[#3A312B] text-xs hover:border-[#E5A93B]">3</button>
                  <button className="w-8 h-8 rounded-lg bg-[#1A1512] border border-[#3A312B] text-xs hover:border-[#E5A93B]">&gt;</button>
                </div>
              </div>
            </div>

            {/* Banners Adicionais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
              <div className="rounded-3xl bg-[#1A1512] p-8 border border-[#3A312B] flex items-center justify-between gap-6">
                <div className="space-y-3">
                  <h3 className="text-lg font-black leading-snug">Lançamentos gênesis<br />de edição limitada</h3>
                  <p className="text-xs text-[#A89F95]">Colecione edições exclusivas diretamente dos criadores antes da revelação pública.</p>
                  <button className="text-xs font-bold text-[#E5A93B] flex items-center gap-1 hover:underline">Explorar →</button>
                </div>
                <img src="/assets/nfts/emerald-ape.png" className="w-32 h-32 rounded-2xl object-cover" alt="" />
              </div>
              <div className="rounded-3xl bg-[#1A1512] p-8 border border-[#3A312B] flex items-center justify-between gap-6">
                <div className="space-y-3">
                  <h3 className="text-lg font-black leading-snug">Arte digital selecionada<br />e muito mais</h3>
                  <p className="text-xs text-[#A89F95]">Explore novos artistas, coleções verificadas e obras digitais que definem a rede.</p>
                  <button className="text-xs font-bold text-[#E5A93B] flex items-center gap-1 hover:underline">Explorar →</button>
                </div>
                <img src="/assets/nfts/neon-vessel.png" className="w-32 h-32 rounded-2xl object-cover" alt="" />
              </div>
            </div>

            {/* Diário da Cunhagem */}
            <div className="space-y-8 pt-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black">Diário da Cunhagem</h2>
                <p className="text-xs text-[#A89F95]">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { title: "Como funciona a propriedade de NFTs", date: "12 de setembro", time: "Leitura de 6 min", img: "/assets/nfts/emerald-ape.png" },
                  { title: "10 artistas digitais para acompanhar", date: "13 de setembro", time: "Leitura de 3 min", img: "/assets/nfts/sage-nomad.png" },
                  { title: "Raridade, atributos e procedência", date: "15 de setembro", time: "Leitura de 3 min", img: "/assets/nfts/neon-vessel.png" },
                  { title: "Como proteger sua carteira", date: "15 de setembro", time: "Leitura de 2 min", img: "/assets/nfts/cosmic-bloom.png" }
                ].map((blog, idx) => (
                  <div key={idx} className="bg-[#1A1512] border border-[#2A2421] rounded-2xl p-4 space-y-3">
                    <img src={blog.img} className="w-full aspect-video object-cover rounded-xl" alt="" />
                    <span className="text-[10px] text-[#A89F95] block">{blog.date} | {blog.time}</span>
                    <h4 className="font-bold text-sm leading-snug">{blog.title}</h4>
                    <span className="text-xs text-[#E5A93B] cursor-pointer hover:underline block pt-2">Ler mais →</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentView === 'detail' && selectedNftId && (
          <NftDetailView nftId={selectedNftId} onBack={() => { setCurrentView('home'); setSelectedNftId(null); }} onAddToCart={(id) => addToCartMutation.mutate(id)} />
        )}

        {currentView === 'cart' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold">Carrinho de NFTs</h2>
            <div className="bg-[#1A1512] border border-[#2A2421] rounded-2xl p-6 space-y-4">
              {cart.length === 0 ? (
                <p className="text-[#A89F95] text-center py-8">O seu carrinho está vazio.</p>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b border-[#2A2421] pb-4">
                    <div className="flex items-center gap-4">
                      <img src={item.image} className="w-16 h-16 rounded-xl object-cover" alt="" />
                      <div>
                        <h4 className="font-bold">{item.name}</h4>
                        <p className="text-xs text-[#A89F95]">Qtd: {item.quantity}</p>
                      </div>
                    </div>
                    <span className="font-bold text-[#E5A93B]">{item.price}</span>
                  </div>
                ))
              )}
              {cart.length > 0 && (
                <div className="pt-4 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-[#A89F95]">Pronto para finalizar</p>
                    <p className="text-xl font-black text-[#E5A93B]">Ambiente Seguro</p>
                  </div>
                  <button 
                    onClick={() => setCurrentView('checkout')}
                    className="px-6 py-3 rounded-xl bg-[#E5A93B] text-black font-bold hover:bg-[#d49933] transition-all"
                  >
                    Ir para Checkout
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {currentView === 'checkout' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold">Pagamento com Carteira</h2>
            <div className="bg-[#1A1512] border border-[#2A2421] rounded-2xl p-6 space-y-4">
              <p className="text-sm text-[#A89F95]">Selecione a carteira e confirme a transação simulada na blockchain:</p>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 rounded-xl border border-[#3A312B] bg-[#221C18] cursor-pointer">
                  <span className="font-semibold">MetaMask (Rede Ethereum)</span>
                  <input type="radio" name="wallet" defaultChecked className="accent-[#E5A93B]" />
                </label>
              </div>
              <button 
                onClick={() => alert('Compra confirmada com sucesso! Recibo gerado.')}
                className="w-full py-4 rounded-xl bg-[#E5A93B] text-black font-bold hover:bg-[#d49933] transition-all mt-4"
              >
                Confirmar Compra e Gerar Recibo
              </button>
            </div>
          </div>
        )}

        {currentView === 'profile' && (
          <div className="max-w-xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold">Perfil do Colecionador</h2>
            <div className="bg-[#1A1512] border border-[#2A2421] rounded-2xl p-6 space-y-4">
              <div>
                <label className="block text-xs text-[#A89F95] mb-1">Nome de Exibição</label>
                <input type="text" defaultValue="Erick Bittencourt" className="w-full bg-[#221C18] border border-[#3A312B] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#E5A93B]" />
              </div>
              <div>
                <label className="block text-xs text-[#A89F95] mb-1">E-mail</label>
                <input type="email" defaultValue="contato@ebsolutions.com" className="w-full bg-[#221C18] border border-[#3A312B] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#E5A93B]" />
              </div>
              <button 
                onClick={() => alert('Perfil guardado com sucesso!')}
                className="w-full py-3 rounded-xl bg-[#E5A93B] text-black font-bold hover:bg-[#d49933] transition-all"
              >
                Guardar Alterações
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Rodapé Completo */}
      <footer className="border-t border-[#2A2421] mt-24 bg-[#16120F] py-16 text-xs text-[#A89F95]">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 pb-12 border-b border-[#2A2421]">
          <div className="space-y-4">
            <span className="text-xl font-black text-[#E5A93B]">KURIO</span>
            <p>Feito para colecionadores, criadores e cultura.</p>
          </div>
          <div className="space-y-3">
            <h4 className="font-bold text-white uppercase text-sm">Meu perfil</h4>
            <p className="hover:text-white cursor-pointer">Minha coleção</p>
            <p className="hover:text-white cursor-pointer">Atividade</p>
            <p className="hover:text-white cursor-pointer">Estúdio do criador</p>
          </div>
          <div className="space-y-3">
            <h4 className="font-bold text-white uppercase text-sm">Central de ajuda</h4>
            <p className="hover:text-white cursor-pointer">Como comprar NFTs</p>
            <p className="hover:text-white cursor-pointer">Carteira e segurança</p>
            <p className="hover:text-white cursor-pointer">Política do mercado</p>
          </div>
          <div className="space-y-3">
            <h4 className="font-bold text-white uppercase text-sm">Coleções</h4>
            <p className="hover:text-white cursor-pointer">Arte digital</p>
            <p className="hover:text-white cursor-pointer">Fotografia</p>
            <p className="hover:text-white cursor-pointer">Música</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pt-8 text-center">
          <p>© 2026 Kurio. Propriedade digital para todos.</p>
        </div>
      </footer>
    </div>
  )
}

function NftDetailView({ nftId, onBack, onAddToCart }: { nftId: string; onBack: () => void; onAddToCart: (id: string) => void }) {
  const currentNft = FALLBACK_NFTS.find(n => n.id === nftId) || FALLBACK_NFTS[0]

  return (
    <div className="max-w-4xl mx-auto bg-[#1A1512] border border-[#2A2421] rounded-3xl p-8 space-y-6">
      <button onClick={onBack} className="text-sm text-[#E5A93B] hover:underline">
        ← Voltar ao catálogo
      </button>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="aspect-square rounded-2xl overflow-hidden bg-[#221C18]">
          <img src={currentNft.image} alt={currentNft.name} className="w-full h-full object-cover" />
        </div>
        <div className="space-y-6 flex flex-col justify-between">
          <div className="space-y-2">
            <span className="text-xs text-[#A89F95] uppercase tracking-wider">{currentNft.collection}</span>
            <h1 className="text-3xl font-black text-[#F3EFEA]">{currentNft.name}</h1>
            <p className="text-sm text-[#A89F95]">Edição verificada na blockchain Ethereum.</p>
          </div>
          <div className="border-t border-[#2A2421] pt-6 space-y-4">
            <div>
              <span className="text-xs text-[#A89F95] block">Preço Atual</span>
              <div className="text-3xl font-bold text-[#E5A93B]">{currentNft.price}</div>
            </div>
            <button 
              onClick={() => onAddToCart(currentNft.id)}
              className="w-full py-4 rounded-xl bg-[#E5A93B] text-black font-bold hover:bg-[#d49933] transition-all shadow-lg shadow-[#E5A93B]/10"
            >
              Adicionar ao Carrinho e Comprar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainApp />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

export default App