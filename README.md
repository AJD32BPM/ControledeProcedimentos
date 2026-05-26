# AJD — Controle de Procedimentos Administrativos

Sistema para controle de procedimentos administrativos militares (Averiguação, IPM, Sindicância, Inquérito Técnico, Parecer Técnico e Averiguação Sumária), com:

- Dashboard com KPIs, gráficos e alertas de vencimento
- CRUD de procedimentos, encarregados e administradores
- Prazos e prorrogações editáveis por tipo
- Alertas visuais por status (dentro do prazo, próximo do vencimento, vencido, sobrestado)
- Notificação automática via **WhatsApp Business API** quando faltam 5 dias para o vencimento
- Multi-admin com autenticação por email + senha
- Visual idêntico ao projeto `folgas-32bpm` (dark theme, dourado militar, fontes Rajdhani/Inter)

Stack: **React 18 + Supabase + Vercel + WhatsApp Cloud API (Meta)**.

---

## Passo 1 — Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e clique em **New Project**
2. Escolha um nome (ex.: `controle-procedimentos-ajd`), defina uma senha forte e crie
3. Aguarde 1-2 minutos até o projeto provisionar
4. No menu lateral → **SQL Editor** → cole todo o conteúdo de `supabase_setup.sql` → **Run**
5. Vá em **Project Settings → API** e anote:
   - **Project URL** (ex.: `https://xxxx.supabase.co`)
   - **anon public key** (para o front-end)
   - **service_role key** (para o backend — **mantenha em segredo!**)

### Trocar a senha do admin inicial

O SQL cria um admin: `admin@ajd.local` / senha `ajd@2026`.
**Faça login, vá em "Administradores" e cadastre seu admin real, depois desative o inicial.**

---

## Passo 2 — Subir o código no GitHub

1. Crie um repositório novo no GitHub (ex.: `controle-procedimentos-ajd`)
2. Faça upload de todos os arquivos desta pasta para o repositório

---

## Passo 3 — Configurar a WhatsApp Business API

Você precisa de uma conta Meta Business e um número aprovado:

1. Acesse [developers.facebook.com](https://developers.facebook.com) → **My Apps → Create App**
2. Escolha tipo **Business** → adicione o produto **WhatsApp**
3. Em **WhatsApp → API Setup** anote:
   - **Phone Number ID**
   - **Token de acesso permanente** (gere em System Users → Generate Token, com permissões `whatsapp_business_messaging` e `whatsapp_business_management`)
4. **Cadastre o template de mensagem** (obrigatório para envios proativos):
   - Vá em **WhatsApp Manager → Templates → Create Template**
   - Nome: `aviso_prazo_procedimento`
   - Categoria: **UTILITY**
   - Idioma: **Português (BR)**
   - Corpo:
     ```
     Olá {{1}}, lembramos que o procedimento {{2}} Nº {{3}} sob sua responsabilidade tem prazo final em {{4}} dia(s). Favor providenciar o quanto antes.
     ```
   - Aguarde aprovação da Meta (24-48h)

---

## Passo 4 — Publicar na Vercel

1. Acesse [vercel.com](https://vercel.com) e entre com sua conta GitHub
2. Clique em **Add New → Project** → selecione o repositório
3. Antes de clicar em Deploy, abra **Environment Variables** e adicione:

| Variável                    | Valor                                  |
|-----------------------------|----------------------------------------|
| `REACT_APP_SUPABASE_URL`    | Project URL do Supabase                |
| `REACT_APP_SUPABASE_ANON_KEY` | anon public key                      |
| `SUPABASE_URL`              | Project URL do Supabase (mesma URL)    |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (segredo!)            |
| `WHATSAPP_PHONE_NUMBER_ID`  | ID do número Meta Cloud                |
| `WHATSAPP_ACCESS_TOKEN`     | Token permanente Meta                  |
| `WHATSAPP_TEMPLATE_NAME`    | `aviso_prazo_procedimento`             |
| `WHATSAPP_TEMPLATE_LANG`    | `pt_BR`                                |
| `CRON_SECRET`               | String aleatória longa (opcional)      |

4. Clique em **Deploy** e aguarde 2-3 minutos

O cron de notificações roda automaticamente todos os dias às **11h UTC (08h de Brasília)**. Ele varre os procedimentos em andamento e envia um WhatsApp ao encarregado quando faltam 5 dias ou menos para o vencimento, e quando o procedimento vence.

Para testar manualmente, acesse no navegador (após o deploy):

```
https://SEU-PROJETO.vercel.app/api/cron-notifica-whatsapp
```

(se você configurou `CRON_SECRET`, precisa enviar `Authorization: Bearer SEU_SECRETO`)

---

## Tipos de procedimentos e prazos padrão

| Tipo                    | Prazo  | Prorrogação |
|-------------------------|--------|-------------|
| Averiguação             | 30 d   | + 20 d      |
| IPM                     | 40 d   | + 20 d      |
| Sindicância             | 30 d   | + 20 d      |
| Inquérito Técnico       | 15 d   | + 5 d       |
| Parecer Técnico         | 15 d   | + 5 d       |
| Averiguação Sumária     | 15 d   | sem prorrogação |

Os prazos são **editáveis** na aba "⚙️ Tipos & Prazos" do sistema. Mudanças afetam apenas procedimentos novos — os existentes mantêm o prazo salvo no momento do cadastro (e podem ser editados individualmente).

---

## Status visuais

| Status                     | Cor     | Critério                                |
|----------------------------|---------|-----------------------------------------|
| Dentro do prazo            | Verde   | mais de 5 dias até o limite             |
| Próximo do vencimento      | Âmbar   | 5 dias ou menos até o limite (pulsa)    |
| Vencido                    | Vermelho| dias restantes negativos (pulsa forte)  |
| Sobrestado                 | Roxo    | marcado manualmente — não conta prazo   |
| Concluído                  | Cinza   | encerrado — registra data e desfecho    |

---

## Rodando localmente

```bash
npm install
cp .env.example .env.local       # edite com sua URL e anon key do Supabase
npm start                        # abre em http://localhost:3000
```

O cron NÃO roda em desenvolvimento (é uma serverless function da Vercel). Para testar a notificação manualmente, faça o deploy e acesse a rota `/api/cron-notifica-whatsapp`.

---

## Estrutura

```
.
├── api/
│   └── cron-notifica-whatsapp.js   # Serverless function (Vercel Cron)
├── public/
│   ├── index.html
│   └── manifest.json
├── src/
│   ├── App.js                       # App principal (todas as telas)
│   ├── index.js                     # Entrypoint React
│   ├── index.css                    # Tema dark + fontes
│   ├── supabaseClient.js            # Cliente Supabase
│   └── utils.js                     # Helpers (prazos, status, hash)
├── supabase_setup.sql               # Schema do banco
├── vercel.json                      # Config Vercel + cron diário
├── package.json
└── .env.example
```

---

## Suporte

Dúvidas, bugs ou sugestões: abrir issue no GitHub.
