# Kurio — Marketplace de NFTs Responsive

O **Kurio** é uma plataforma moderna e totalmente responsiva para exploração, coleção e compra de arte digital (NFTs). O projeto foi construído com foco em **fidelidade visual ao Figma**, **performance**, **acessibilidade** e **arquitetura limpa**, utilizando o ecossistema moderno do React.

---

## 🎨 Funcionalidades Principais

- **Catálogo Dinâmico & Filtros:**
  - Listagem de NFTs com suporte a filtragem por categorias (Arte digital, Fotografia, Arte 3D, etc.), faixas de preço e redes blockchain.
  - Ordenação e seções especiais como **Novos Lançamentos**, **Em Alta** e **NFT em Destaque (Oferta Limitada)**.

- **Página de Detalhes do NFT:**
  - Visualização expandida da obra com informações sobre edição verificada, coleção e ação direta de compra.

- **Gerenciamento de Carrinho & Checkout:**
  - Adição e remoção de itens com atualização de contador em tempo real na navegação.
  - Simulação de fluxo de pagamento seguro via integração com carteiras Web3 (MetaMask, WalletConnect).

- **Perfil do Colecionador:**
  - Área dedicada para gerenciamento de dados de conta e preferências do utilizador.

- **Simulação em Tempo Real (Socket.IO) & Mock Server (MSW):**
  - Integração para escuta de eventos de atualização de preços e estados de pedidos.
  - Fallbacks automáticos para garantir resiliência e apresentação contínua dos componentes visuais mesmo em cenários de falha na API.

- **Seções Editoriais:**
  - Banners promocionais para lançamentos gênesis e o blog **Diário da Cunhagem** para guias e notícias.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React (Vite), TypeScript, Tailwind CSS
- **Gerenciamento de Estado Remote & Cache:** TanStack Query (React Query)
- **Comunicação em Tempo Real:** Socket.IO Client
- **Requisições HTTP:** Axios
- **Mocking de API:** MSW (Mock Service Worker)
- **Qualidade & Testes:** ESLint, Playwright (E2E)

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos

Certifique-se de ter instalado na sua máquina:
- **Node.js** (versão 18 ou superior)
- **pnpm** (ou `npm` / `yarn`)

### Passo a Passo

1. **Clonar o repositório:**
   ```bash
   git clone [https://github.com/bittenk/kurio-marketplace.git](https://github.com/bittenk/kurio-marketplace.git)
   cd kurio-marketplace
   
2. **INSTALAR AS DEPENDÊNCIAS:

  pnpm install

3. INICIAR O SERVIDOR DE DESENVOLVIMENTO:

  pnpm dev

4. ACESSAR A APLICAÇÃO:
- Abra o navegador e acesse:

  http://localhost:5173/

  