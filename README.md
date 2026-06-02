# SIM Solo MVP

Este projeto foi criado com o Skip.

## 🚀 Stack Tecnológica

- **React 19**
- **Vite**
- **TypeScript**
- **Shadcn UI**
- **Tailwind CSS**
- **React Router**

## 📋 Pré-requisitos

- Node.js 18+
- npm

## 🔧 Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
VITE_SUPABASE_URL=sua_url_aqui
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_aqui
```

## 💻 Comandos de Desenvolvimento

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Build para produção
npm run build

# Executar linter
npm run lint
```

## 🗄️ Banco de Dados e Migrations

Este projeto utiliza o Supabase e extensões geográficas (PostGIS).
As migrations iniciais criam as tabelas e o seed da organização "SIM", com uma usuária admin `kimberly@adapta.org` / `Skip@Pass`.

Para aplicar as migrations e o seed no ambiente local ou remoto:
```bash
npx supabase db push
```

### Associação Manual de Usuários
Novos usuários podem criar contas, mas precisarão ser vinculados a uma organização para acessarem os dados. 
O vínculo pode ser feito via Dashboard do Supabase (tabela `organization_members`):
1. Verifique o ID do usuário na tabela `auth.users` ou `profiles`.
2. Adicione uma nova linha na tabela `organization_members`, passando o `organization_id` correspondente, o `user_id`, e definindo a `role` (viewer, technician, admin).

## Status
Fase 1 concluída

## 🗺️ Fluxos Principais

### Importação Geográfica (Shapefile ZIP)
O sistema permite o upload de arquivos `.zip` contendo os formatos `.shp`, `.shx` e `.dbf`. Ao submeter, uma Edge Function do Supabase (escrita em Deno) extrai o polígono da área e os pontos de amostragem. O usuário visualiza uma prévia no mapa e, ao confirmar, os dados são salvos nas tabelas `areas` e `sampling_points`.

### Importação de Análises de Laboratório (Excel)
Os usuários podem enviar resultados laboratoriais via arquivos `.xlsx`. O sistema lê as abas `SOLO_0_20` e `SOLO_20_40`, mapeando a coluna `PONTO` aos pontos de amostragem criados na importação geográfica. Os dados são registrados nas tabelas `samples` e `lab_measurements`.
