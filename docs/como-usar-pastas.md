# Como usar: estrutura das pastas na rede

A estrutura vale a partir da v3.0.0-alpha.14 (pedido de 17/11/2026). A ferramenta cria as pastas, lê os arquivos por elas e grava os Excel gerados nelas. Ela **nunca** apaga, renomeia ou move arquivos.

## 1. A estrutura

```
App repasse médico/                      ← pasta raiz (escolhida no Edge; cada um acessa pelo seu caminho de rede)
├── 01 - Sistema/                        ← arquivos permanentes, de todas as competências
│   ├── Backups/
│   ├── Configurações compartilhadas/    (configuracao.json)
│   ├── Equivalências TUSS/              (equivalencias.json)
│   ├── Fluxo mensal/                    (um arquivo por competência)
│   ├── Bases compartilhadas/
│   └── Outros arquivos permanentes do sistema/
├── 02 - Repasse 2026/
│   ├── 2026-01 - Janeiro/ … 2026-12 - Dezembro/
└── 03 - Repasse 2027/                   (mesma estrutura; um ano por pasta)
```

Cada competência tem:

| Pasta | O que a ferramenta faz |
|---|---|
| `01 - Correção de prestador` | Lê os PDFs, sem subpastas. A unidade vem do nome do arquivo, no formato `nome_unidade` (ex.: `generico_17.pdf`, `generico_Cambe.pdf`). Grava o Excel da correção |
| `02 - Não conformidades` | Grava a planilha de NCs (todas as unidades) |
| `03 - NFS para pagamento` › `Pagamento 15` \| `Pagamento 30` | Só cria as pastas |
| `04 - Planilhas de conferência` | Lê a planilha de laudos do Apolo e a do Power BI (a mais recente de cada) |
| `05 - Relatórios de repasse MV` › `USG` \| `IMG` › unidade; `Curitiba` › `Prestadores Unidade` \| `Prestadores SRA` | Lê os PDFs. Grava o Excel da conferência ao lado do PDF. Outras pastas aqui (Repasse 20%, 25%, anestesistas…) são da equipe e **não são lidas** |
| `06 - Relatórios de prestadores conferidos` › Ecodoppler, Sedação, IMG, Curitiba, USG | Só cria as pastas (preenchimento manual) |
| `07 - Mutirão unidades` | Só cria a pasta |
| `08 - Repasse final` | Só cria a pasta. A ferramenta **não grava** aqui |

- **Nomes das pastas das unidades** (em USG e IMG): saem do cadastro de unidades (Bases e regras → Unidades), sem o complemento entre parênteses. Exemplo: «17 - ALPHASONIC LONDRINA (PALHANO)» vira `Alphasonic Londrina`.
- **Mesmo nome de arquivo:** quando já existe um arquivo com o mesmo nome, a ferramenta grava como « (2)», « (3)»… Nunca substitui.

## 2. Criar as pastas

Os botões estão em Configurações → Pastas e sincronização → «Estrutura das pastas», e também no cartão da pasta raiz, no Início:
- «Criar pastas da competência»;
- «Criar pastas de 2026»;
- «Criar pastas de 2027».

A ferramenta mostra antes o que vai criar. Pastas que já existem não são duplicadas.

## 3. Mudar da estrutura antiga para a nova (manual)

A ferramenta lê as duas. Nada para de funcionar enquanto você não mover, então faça com calma:

1. **Os dois atualizam a ferramenta** para a v3.0.0-alpha.14 (ou mais nova) antes de mover qualquer coisa.
2. **Crie as pastas novas:** «Criar pastas de 2026» e «Criar pastas de 2027». As pastas de `01 - Sistema` que ainda existem no lugar antigo **não** são criadas, para os dois continuarem lendo e gravando no mesmo lugar.
3. **Arquivos permanentes.** Com a ferramenta fechada nos dois computadores, mova cada pasta inteira (com os .json dentro) para `01 - Sistema`, renomeando:
   - `Fluxo mensal` → `01 - Sistema/Fluxo mensal`;
   - `Equivalência TUSS (sincronização)` → `01 - Sistema/Equivalências TUSS`;
   - `Configuração compartilhada` → `01 - Sistema/Configurações compartilhadas`;
   - `backups` → `01 - Sistema/Backups`.
4. **Competências de 2026**, de `Competências/Comp_MM-AAAA` para `02 - Repasse 2026/AAAA-MM - Mês`:
   - `Correção de prestador/Unidade N…/*.pdf` → `01 - Correção de prestador/`, renomeando cada PDF para `nome_N.pdf` (ex.: `generico_17.pdf`);
   - `Não conformidades` → `02 - Não conformidades`;
   - NFs → `03 - NFS para pagamento/Pagamento 15` ou `Pagamento 30`;
   - planilhas de `Bases de dados/Comp_MM-AAAA` (ou `Planilhas utilizadas para conferência`) → `04 - Planilhas de conferência`;
   - `Relatórios para conferência/USG|IMG/Unidade N - …` → `05 - Relatórios de repasse MV/USG|IMG/<nome da unidade>`;
   - `Relatórios para conferência/Curitiba` → `05 - Relatórios de repasse MV/Curitiba/Prestadores Unidade` ou `Prestadores SRA`;
   - `Conferência cruzada` (Excel antigos) → `05 - …/USG|IMG/<unidade>`, ou guarde em `_antigos`.
5. **Confira.** Abra a ferramenta e clique em «Atualizar da pasta». O cartão da pasta raiz, no Início, avisa «Estrutura antiga ainda em uso» enquanto houver algo no lugar antigo e diz o que falta mover. Quando os PDFs e as planilhas aparecerem certos, apague as pastas antigas ou renomeie para começar com «_» (ex.: `_Competências antigas`), que a ferramenta ignora.

## 4. O que ficou fora

- As pastas de Repasse 20% (Alpha Scann), 25%, anestesistas e outras da equipe: a ferramenta não cria, não lê e não grava nelas.
- O PDF final para o médico conferir (sem valor total) continua sendo feito por você, em `06 - Relatórios de prestadores conferidos`.
