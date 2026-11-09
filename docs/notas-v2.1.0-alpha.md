# Repasse Médico v2.1.0-alpha — notas da versão

Esta versão fecha o ciclo da 2.0: a ferramenta passa a ligar as telas entre si, com menos digitação repetida. O que você confere na Conferência alimenta o Fechamento, o Fluxo mensal, as NCs e os indicadores.

## O que há de novo desde a v2.0.0-alpha.16

### Conferência
- **Regras compostas e por convênio (F5):** um laudo pode sustentar mais de uma linha do MV, como «USG de ombro com doppler» = articular + doppler, e na UNIMED só o doppler. A conferência aponta o código que **falta** («Composição incompleta») ou que **sobra** para aquele convênio. O cadastro fica em Equivalências → «Regras compostas e por convênio».
- **Power BI explica os «Só no laudo» (F9):** com o Power BI carregado, cada laudo sem lançamento no relatório é procurado no faturamento. O resultado é um destes:

  | Situação | O que significa |
  |---|---|
  | Sem lançamento | não há lançamento do paciente na data |
  | Lançado para outro prestador | o lançamento está com outro código de prestador |
  | Lançado para o médico do laudo | está no relatório do médico que laudou |
  | Conta aberta | a conta ainda não foi fechada |
  | Sem remessa | a conta foi fechada, mas não tem remessa |
  | Lançado depois da geração | provavelmente entrou depois que o repasse foi gerado |

  A situação vira a natureza sugerida da NC. O responsável sugerido é quem fechou a conta. Conta e atendimento já vêm preenchidos.

- **Regras compostas v2 (alpha.3):** vários títulos ou palavras por regra, quantidade por código (mamas: Doppler ×2), exceção por convênio (UNIMED: Doppler ×1 nas mamas; punho e tireoide só com o Doppler), busca no cadastro, simulação antes de validar e efetividade real na lista. Na competência 10/2026, as 5 regras levaram a cobertura de 0% para 9,4%.
- **Fusão de imagem pelo percentual da unidade (alpha.4):** a fusão vale o percentual geral de repasse da unidade onde foi feita (ex.: unidade 1 = 44% do valor faturado). Em Bases → Classes, colunas «Ou % do valor faturado» e «Ou % da unidade».

- **Prestadores por unidade (alpha.5, SOL-F35):** na Conferência, quem laudou na planilha de laudos × quem já tem relatório, conferência e aceite, por unidade (USG com Doppler, IMG e Curitiba pela regra V3). Lista «gerar no MV» em Excel ou impressa, avisos no Início, no Fechamento e no Fluxo.

- **Fluxo compartilhado (alpha.6, SOL-F36):** o Fluxo mensal pode ficar numa pasta da rede e sincroniza entre as pessoas (Edge ou Chrome). Card «Divisão do trabalho»: quem assumiu cada unidade × grupo, com o que falta, e aviso ao entrar numa unidade de outra pessoa.

- **Conflitos viram regra composta (alpha.7):** no card de conflitos de Equivalências, «Um ou outro» (ex.: escroto = bolsa escrotal ou órgãos superficiais) ou «Juntos» (título com Doppler = base + Doppler). A Divisão do trabalho virou subaba do Fluxo.

- **Compostas na lista de pendentes (alpha.8):** Equivalências → Visualização «Agrupar por título» com «Juntos», «Um ou outro» e «Só o marcado»; botão «Criar regra composta com as selecionadas»; relações resolvidas por regra validada ficam «Cobertas por regra composta».

- **Pasta raiz na rede (alpha.9):** no Início, conectar a pasta raiz uma vez, criar as pastas do mês com os nomes certos e «Atualizar da pasta» (PDFs do MV e planilhas lidos da pasta, só o que mudou). Equivalências TUSS sincronizadas entre as pessoas, como o Fluxo.

### Não conformidades
- **Candidatos guardados (F17):** os candidatos a NC e os dispensados não se perdem mais ao recarregar a página. Ficam na competência com a mesma retenção de 60 dias.

### Fluxo mensal
- **Lista de prestadores vinda de Bases (F14):** USG, IMG e Curitiba se montam sozinhos a partir das regras cadastradas.
- **Classificação vinda do Fechamento (F13):** produção e classe já calculadas. Você só confere (com um clique para todos) ou ajusta com justificativa.
- **Status sugerido (F16):** cada etapa mostra o que os dados dizem (ex.: «12 de 14 com aceite»). Você confirma com um clique, e nada muda sozinho.

### Versões anteriores da 2.0 (resumo)
- **Conferência:** aceite na própria tela, «aceitar e ir para o próximo», cobertura de equivalências, «O que mais destrava» com validação em lote, médico do laudo pelo cadastro e Excel nomeado por médico, unidade, competência e rodada.
- **Fechamento:** USG, IMG e Curitiba (V3) com a regra de cada médico, memória de cálculo e texto do e-mail. Também NF complementar por categoria, descontos parcelados com alertas, situação com menu de ações e exportação no layout da planilha de controle.
- **Bases:** regras por prestador, médicos V3 (valor fixo por grupo ou percentual), atalho para cadastrar médicos do Apolo, convênios e faturistas.

## Próximo passo: testar com a competência 10/2026 completa
Para rodar todos os testes de USG, IMG, médicos da V3 e classificação de NCs com dados reais, preciso dos arquivos abaixo. Eles ficam só na pasta `dados/` do ambiente, fora do Git.

| Para testar | Arquivos | Sugestão de nome |
|---|---|---|
| **USG** | Relatórios de repasse de USG do MV (PDF), um por prestador × unidade | `MV_USG_<cód>_<nome>_un<unidade>.pdf` |
| **IMG** | Relatórios de repasse de IMG do MV (PDF), um por prestador × unidade | `MV_IMG_<cód>_<nome>_un<unidade>.pdf` |
| **Correção de prestador** | Relatórios do prestador genérico (Gilberto, código 2), por unidade | `MV_GENERICO_un<unidade>.pdf` |
| **V3 (Curitiba)** | Relatórios do MV da unidade 5, por médico (USG e IMG) | `MV_V3_<cód>_<nome>.pdf` |
| **V3, conferência dos valores** | E-mails ou memórias de cálculo enviados aos médicos V3 em 10/2026 e as regras do Dr. Alexandre e dos demais | `V3_EMAIL_<nome>.pdf` ou `.txt` |
| **Laudos** | Planilha do Apolo, produção 09/2026 (todas as unidades) | `APOLO_09-2026.xlsx` |
| **Faturamento** | Power BI, produção 09/2026, com «Conta Fechada?», «Cod. Remessa» e quem fechou a conta | `POWERBI_09-2026.xlsx` |
| **Fechamento esperado** | Planilha de controle final de 10/2026 (a que foi para o Financeiro) | `CONTROLE_REPASSE_10-2026_FINAL.xlsx` |
| **NCs** | Planilha de NCs de 10/2026 com a classificação feita por vocês (natureza, responsável) | `NC_10-2026.xlsx` |
| **Equivalências (se houver)** | Base exportada da ferramenta (JSON), se você já validou relações | `EQUIVALENCIAS_<data>.json` |

Com isso, a ferramenta roda a competência inteira e eu comparo os resultados com o que vocês fizeram à mão:
- valores do fechamento por prestador;
- classes;
- totais da V3;
- NCs encontradas × NCs registradas.
