# Cidade da Inflação

Visualização 3D interativa da **inflação acumulada dos 9 grandes grupos do IPCA**, cada um representado como um prédio em uma cidade.

- **10 andares** na data-base = preços iguais à base  
- **20 andares** = preços dobraram (+100%)  
- Altura = `10 × índice acumulado`, calculado só com **variação mensal**

Histórico unificado: **jul/2006 → mês mais recente** (SIDRA tabelas **2938 + 1419 + 7060**).

## Como rodar

```bash
# 1) Coloque os exports do SIDRA em public/data/
#    - tabela2938.csv  (grupos IPCA, jul/2006–dez/2011)
#    - tabela1419.csv  (grupos IPCA, jan/2012–dez/2019)
#    - tabela7060.csv  (grupos IPCA, jan/2020 em diante)

# 2) Gere o dataset unificado
npm run build:data

# 3) Suba o site
npm install
npm run dev
```

Abra o endereço do Vite (geralmente `http://localhost:5173`).

Build de produção:

```bash
npm run build:data
npm run build
npm run preview
```

## GitHub Pages

O deploy é automático via GitHub Actions (`.github/workflows/deploy-pages.yml`) em todo push na `main`.

1. No repositório: **Settings → Pages → Source = GitHub Actions**
2. Faça push na `main` (ou rode o workflow manualmente em **Actions**)
3. Site: [https://gmbueno.github.io/inflacity/](https://gmbueno.github.io/inflacity/)

O workflow roda `npm run build:data` e `npm run build` com `VITE_BASE=/inflacity/`.

## Pipeline de dados

| Arquivo | Período | Papel |
|---------|---------|--------|
| `public/data/tabela2938.csv` | jul/2006 – dez/2011 | Grupos IPCA |
| `public/data/tabela1419.csv` | jan/2012 – dez/2019 | Grupos IPCA |
| `public/data/tabela7060.csv` | jan/2020 → | Grupos IPCA |
| `public/data/selecionados/*.csv` | (varia; hoje ~2020→) | Itens/produtos selecionados |
| `public/data/ipca_grupos_unificado.csv` | unificado | Ilha dos Grupos |
| `public/data/ipca_selecionados_unificado.csv` | unificado | Ilha dos Selecionados |

Para estender o histórico dos selecionados até 2006, basta colocar CSVs adicionais (ex. tabela 1419/2938 filtrada nos mesmos itens) em `public/data/selecionados/` e rodar `npm run build:data` de novo.

O script `npm run build:data` (`scripts/build-ipca-dataset.js`):

1. Lê os três CSVs do SIDRA (parser tolerante a matriz/longo, `;`/`,`, decimais BR)
2. Filtra só **IPCA - Variação mensal**
3. Mapeia os **9 grupos** (código primeiro; nome normalizado só como fallback)
4. Normaliza datas para `YYYY-MM-01`
5. Resolve sobreposição por período canônico:
   - **2938** até dez/2011  
   - **1419** de jan/2012 a dez/2019  
   - **7060** a partir de jan/2020  
6. Escreve o CSV unificado com colunas estáveis:

```text
date,year,month,group_code,group_name,short_name,monthly_variation,source_table
2006-07-01,2006,7,1,Alimentação e bebidas,Alimentação,0.09,2938
...
2012-01-01,2012,1,1,Alimentação e bebidas,Alimentação,0.86,1419
...
2020-01-01,2020,1,1,Alimentação e bebidas,Alimentação,0.39,7060
```

Se o unificado não existir, o app mostra:

> Rode `npm run build:data` para gerar o dataset unificado.

## Fórmula

```text
índice_0 = 1
índice_t = índice_{t-1} × (1 + monthly_variation / 100)
andares  = 10 × índice_final
altura_3d = andares × 0.4
```

O acumulado **não** vem do SIDRA — só a variação mensal.

## Stack

- Vite + React 18  
- Three.js via `@react-three/fiber` + `@react-three/drei`  
- Papa Parse (CSV)  
- Script Node para unificar dados (`build:data`)

## Estrutura

```text
public/data/
  tabela2938.csv
  tabela1419.csv
  tabela7060.csv
  ipca_grupos_unificado.csv   ← gerado
scripts/
  build-ipca-dataset.js
src/
  App.jsx
  data/
    parseUnified.js           ← lê o CSV unificado
    parseSidra.js             ← parser SIDRA (legado / referência)
    inflationMath.js
    groups.js
  components/
    CityScene.jsx, Building.jsx, …
```

## Controles

| Controle | Função |
|----------|--------|
| Arrastar / scroll | Orbitar e zoom |
| Hover | Tooltip |
| Clique | Painel com detalhes |
| Slider de data | Data final (desde a base, tipicamente jul/2006) |
| Acumulado / 12 meses | Métrica de altura |
| Reset câmera | Enquadramento inicial |

## Fonte

IBGE — IPCA, tabelas SIDRA **2938**, **1419** e **7060**. Visualização local; sem backend.
