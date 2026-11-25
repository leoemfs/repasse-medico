# Próximas funções — requisitos registrados

**SOL-F49 implementada na v3.0.0-alpha.23** (descontos que mudam todo mês e lembrete do reajuste anual). **SOL-F47 implementada na v3.0.0-alpha.23** (vários USG do mesmo paciente no mesmo dia: o título do laudo desempata). Detalhes nas seções da SOL-F47 e da SOL-F49.

**SOL-F48 implementada na v3.0.0-alpha.22** (23/11/2026): HM fora da V3 nunca compõe o repasse e é notificado para exclusão do MV, em todos os grupos de HM. Detalhes na seção da SOL-F48.

**SOL-F46 implementada na v3.0.0-alpha.21** (23/11/2026): regras de Curitiba (V3) na conferência cruzada e na correção de prestador. Detalhes na seção da SOL-F46.

**SOL-F20 implementada na v3.0.0-alpha.18** (23/11/2026): Retrospectiva mensal (PDCA) como subaba do Fluxo mensal. Detalhes na seção da SOL-F20.

**SOL-F45 implementada na v3.0.0-alpha.17** (19/11/2026): Excel único da unidade × grupo, gravado em `09 - Planilhas de repasse conferidos`. Detalhes abaixo.

**Atualização de 17/11/2026 — v3.0.0-alpha.9 a alpha.12.** A auditoria técnica de 16/11/2026 (`auditoria-tecnica-2026-11-16.md`) foi feita inteira, do P0 ao P3, e entraram os pedidos de 17/11 (SOL-F44, abaixo). Resumo:

| Versão | O que entrou |
|---|---|
| **3.0.0-alpha.9** | **P0, valor pago.** (1) A NC «não lançado» de um laudo «Só no laudo» não passa mais para o lançamento que o MV fez depois: a linha nova segue a própria classe, e a NC aparece como «Corrigida: lançada no MV». (2) Linha repetida no MV: «Esta é a repetida → NC» tira do fechamento só a duplicata, e a cobrança legítima continua Devido. |
| **3.0.0-alpha.10** | **P1.** Reconferir em um clique, mantendo unidade, médico e aba. Excel com «Processando…» e «Exportar só o filtrado». Candidatos a NC só do prestador, guardados compactos. Rodadas lidas por competência, com retenção (ficam inteiras as com aceite e as mais recentes de cada PDF) e backup só da competência aberta. |
| **3.0.0-alpha.11** | **P2.** Pior caso da conferência de 14,9 s para cerca de 2 s, com o mesmo resultado. Nenhum arquivo redefine função de outro, e a sincronização das três bases ficou num módulo só. A tela de Equivalências não grava ao abrir. Teste de ponta a ponta com arquivos fictícios e testes no GitHub a cada envio. Também a **SOL-F44**. |
| **3.0.0-alpha.12** | **P3.** Código sem uso removido. **Modo celular removido** (decisão do usuário em 17/11). Texto de privacidade atualizado. Modalidade do Apolo por grupo do MV e HM da V3 configuráveis em Bases e regras → «Modalidades e HM V3». |

Os detalhes de cada item estão na própria auditoria, em «Como ficou». Os testes: `test/p0_decisoes.mjs`, `p1_otimizacoes.mjs`, `ponta_a_ponta_ficticio.mjs`, `bench_pior_caso.mjs`, `pasta_por_aba.mjs` e `p3_regras_config.mjs`. Para rodar tudo o que não precisa de `dados/`, use `node tools/testes.mjs`.






## Pareamento: a mesma paciente vem antes de um nome apenas semelhante — **CORRIGIDO na v3.0.0-alpha.46** (caso real de 25/11/2026; teste: `test/mesma_paciente.mjs`)
Caso: relatório da Melanie (10264), unidade 4. A linha do MV «MARTA APARECIDA DA» (40808033, mamografia convencional, 19/10) pareou com o laudo de **outra paciente**, «MARIA APARECIDA FLORA DE SOUZA SZEREMETA» (16/10, Dr. Caio, outro convênio). O laudo certo, da Marta (19/10, Melanie, «Mamografia Digital»), sobrou como «Só no laudo». A usuária aceitou a linha do MV depois de conferir no MV, e o «Só no laudo» continuou aparecendo como erro a cada reconferência.
- **Causa:** o laudo de nome apenas semelhante com título validado para o código cobrado («MAMOGRAFIA BILATERAL» → 40808033) tinha prioridade (faixa 5) sobre o da mesma paciente e data com o título validado para outro código («Mamografia Digital» → 40808041, faixa 6).
- **Correção:** as duas faixas trocaram de lugar. A mesma paciente na mesma data vem antes do nome apenas semelhante. A linha fica Pendente com «Procedimento diverge» (decisão humana, como antes), mas com o laudo certo.
- **Observação do caso:** «Mamografia Digital» é o **nome do modelo de laudo**, não a técnica. A descrição do estudo (STUDY_DESCRIPTION) da Marta e da Camila diz «MAMOGRAFIA CONVENCIONAL BILATERAL». Na planilha de 11/2026, 58 laudos têm título «Mamografia Digital» e descrição convencional. O caminho é validar os títulos de mamografia como «um ou outro» (40808033 ou 40808041).
- **Melhoria possível (não feita, a decidir):** usar a descrição do estudo, quando ela nomeia o exame, como segunda evidência do código.

## Correção da v3.0.0-alpha.45 — barra de título do app instalado (pedido de 25/11/2026)
- O manifesto pedia `window-controls-overlay`: no app instalado o Edge tirava a barra de título e o conteúdo ficava por baixo dos botões da janela, sem área para arrastar. Agora é `standalone` (barra de título normal do Edge).

## Ponte Apolo → Power BI → MV (em conversa, 25/11/2026)
- Power BI não tem ID do paciente (tem `CPF_PACIENTE`); o Apolo não tem CPF. A ponte segue o processo manual: nome completo do Power BI × nome do Apolo, data (atendimento é único por data), unidade (`Nome Empresa`), grupo × modalidade, código × título (equivalências), convênio (com nomes equivalentes) → atendimento → linha do MV pelo número.
- Mais de um atendimento possível: **sempre ressalva** para análise. Prestador do Power BI só informativo.
- **IMPLEMENTADA na v3.0.0-alpha.47** (prévia aprovada: https://claude.ai/artifact/Qbn5XCrRs3jiDJLDjL8SFZ; `docs/prototipos/ponte-atendimento/`; teste: `test/ponte.mjs`):
  - Motor em `src/engine/89b-ponte.js`: `nomeAbreviadoCompat` (Apolo abreviado × nome completo), `indicePBIAtendimentos`, `criteriosPonte` (nome, data, unidade, grupo × modalidade, código × título, convênio) e `ponteDoLaudo` (firme | dúvida | nenhum).
  - Conferência: a linha do MV usa o nome completo do atendimento no Power BI para achar o laudo (mesmo dia). «Só no laudo»: atendimento achado no Power BI, se está ou não neste relatório, e para quem foi faturado (só informativo); dois ou mais atendimentos = dúvida.
  - Na tela, uma linha só («Power BI · atendimento … · N de 6 critérios»), com os critérios recolhidos — pedido de não poluir a tela.

## Pedido de 25/11/2026 — ID, convênio, unidades ignoradas e «Só no laudo»
- **IMPLEMENTADO na v3.0.0-alpha.42:**
  - «ID Apolo» do laudo = coluna `PATIENT_ID`. ID com mais de um paciente aparece como **DUPLICATE** (para investigar); célula vazia, **SEM ID**. Nada é preenchido com dado fictício.
  - Convênio do laudo = `PATIENT_INSURANCE`; vazio aparece como **SEM CONVÊNIO**.
  - Unidades ignoradas por padrão (laudos saem da planilha na leitura): ISCAL, GRUPO SRA LON, Associação da Santa Casa de Misericórdia de Ourinhos, Hospital Providência Apucarana (`parametros.unidadesIgnoradas`).
  - «Só no laudo»: natureza sugerida da NC passa a ser **Prestador incorreto** (na prática, a conta está para outro médico); o Power BI ainda ajusta quando mostra conta aberta, fora de remessa etc.
  - Títulos com acento quebrado (ex.: «TorÃ¡cica») já são corrigidos na leitura (`fixMojibake`).
- **IMPLEMENTADO na v3.0.0-alpha.43** (prévias aprovadas: https://claude.ai/artifact/VSLSUPPdKQQzL29fARx3Vi e https://claude.ai/artifact/Mzf47r6tyJ1d9P1aFZkhNY; `docs/prototipos/convenios-unidades/` e `docs/prototipos/linha-aberta/`):
  - Unidades ignoradas editáveis em Configurações → Parâmetros (uma por linha, «Voltar ao padrão»).
  - «Nomes equivalentes» no cadastro de convênios (Bases e regras), com sugestões dos arquivos carregados; valem na conferência (`convenioCompativel` com o cadastro).
  - Linha aberta da conferência reorganizada: situação numa linha, diagnóstico em uma frase (`diagnosticoLinha`), MV × laudo com identificação (atendimento e ID Apolo copiáveis), esperado × lançado da regra composta (`compostaDet`), candidatos em cartões com sinais e evidências completas recolhidas.

## Correção da v3.0.0-alpha.41 — «linha N da planilha» do laudo deslocada (pedido de 25/11/2026)
- Linhas em branco na planilha do Apolo eram puladas na leitura e o número da linha mostrado no laudo ficava menor que o real. Agora vem o número real da linha no Excel.
- O «ID Apolo» é a coluna de nome exato «ID» da mesma linha do laudo (não mudou).

## Ordem da tabela da Conferência — **IMPLEMENTADA na v3.0.0-alpha.38** (pedido de 24/11/2026; prévia aprovada: https://claude.ai/artifact/3vrHwttWwVnGTuz2deaGPu; teste: `test/ordem_conferencia.mjs`)
Pedido: «gostaria de um filtro que pudesse deixar em ordem alfabética; o Luciano possui dois procedimentos em linhas diferentes, que correspondem ao mesmo laudo de abdome total».
- **«Ordenar por»**, ao lado de «só o que falta decidir»: Ordem do relatório (padrão, a de antes) · Paciente (A→Z) · Data · Procedimento · Laudo (Apolo) · Vl Repasse (maior primeiro).
- **Títulos clicáveis:** Paciente, Data, Procedimento no MV, Laudo (Apolo) e Vl Repasse. Clicar de novo no mesmo título inverte (▲▼). Também funciona pelo teclado (Enter).
- **Paciente (A→Z):** as linhas do mesmo paciente ficam juntas, com faixa alternada por paciente e a marca «N linhas».
- A ordem vale também para a aba «Conferência» do Excel e fica lembrada no navegador de cada pessoa. A conferência em si não muda.
- **O caso do Luciano** não se resolve só com a ordem. «TOMOGRAFIA DE ABDOME TOTAL» na conta são dois códigos (41001109 + 41001117), e isso pede uma regra composta «juntos» com esse título (Equivalências → Títulos do Apolo → «Juntos»).
- Motor: `ordenarLinhasConf` e `gruposPorPaciente` em `63-classes.js`. Prévia guardada em `docs/prototipos/ordenar-conferencia.html`.

## Correção da v3.0.0-alpha.37 — subaba da Conferência voltava para a Prévia (pedido de 24/11/2026)
- Em «O que falta decidir», validar um par ou escolher «Um ou outro» roda a conferência de novo, e o resultado novo voltava para «Prévia de conferência». Agora fica na mesma subaba e no mesmo ponto da tela (mesmo relatório e unidade).
- Revisadas as outras telas com subabas (Equivalências, Fechamento, Fluxo, NCs, Configurações, Prestadores por unidade): guardam a subaba e não têm o problema.

## Equivalências TUSS simplificadas — **IMPLEMENTADA na v3.0.0-alpha.36** (pedido de 24/11/2026; prévia aprovada: https://claude.ai/artifact/Pz54KXDqMFps4d4a48iuCT e `docs/prototipos/equivalencias-simplificadas.html`; teste: `test/eq_tela.mjs`)

**Pedido:**
- A edição era complicada, havia botões demais (5 de importar e exportar) e a lista de conflitos ocupava a tela toda.
- Manter as abas atuais, com uma distribuição mais limpa e direta, que outra pessoa entenda.

**Na aba Base** (as 4 abas continuam):
- **Contadores no topo:** pendentes, validadas, desativadas, cobertas e todas. Clicar filtra a lista; substituem o filtro «Status».
- **«Arquivos ▾»:** um menu com «Trazer» (importar planilha, juntar com outra base, substituir a base) e «Levar» (exportar planilha, exportar base), com uma linha explicando cada opção.
- **«+ Nova»:** cria uma relação ou uma regra composta, conforme a vista aberta.
- **Conflitos:** uma linha de aviso, recolhida, com «Resolver». Quando não há conflito: «✓ Sem conflitos».
- **Seletor Relações | Regras compostas:** as duas listas não ficam mais empilhadas.
- **Relações:** busca e «Mais filtros ▾» (confiança, ambíguas, agrupar por título). Clicar na linha abre, logo abaixo, os dados, o histórico e as ações (Validar, Voltar a pendente, Desativar, Criar regra composta). Não há botões na tabela.
- **Barra de lote:** só aparece com linhas marcadas.
- **Regras compostas:** lista compacta (regra, o que espera na conta, uso no mês, situação). Clicar abre a leitura completa e as ações: Validar, «Editar (4 perguntas)», trocar entre «todos juntos» e «um ou outro», Desativar.

A prévia mostrava a edição no painel lateral; por pedido do usuário, ela foi para a própria linha.

## Exames compostos repetidos no mesmo dia — **IMPLEMENTADA na v3.0.0-alpha.31** (24/11/2026; teste: `test/exames_repetidos.mjs`)

Achado nos testes com 12 relatórios de USG reais de 11/2026 (1.077 linhas, base de equivalências rev65 → rev66):
1. **Falsa ambiguidade.** Dois exames iguais no dia (ex.: dois Dopplers de tireoide, cada um com a sua página de USG): as páginas ficavam ligadas só ao 1º exame, e a 2ª linha virava «Mais de um laudo plausível». Agora, página secundária do mesmo grupo (paciente, dia, modalidade e médico) não conta como alternativa.
2. **«Mesmo estudo» perdido.** Com duas regras compostas no dia (ex.: punção e Doppler), o motor olhava só a primeira e marcava a página de USG como «pode ser o mesmo estudo». Agora vale a regra que reconhece o laudo.

**Resultado nos relatórios reais** (base rev66):
- 892 linhas conferidas, contra 871 sem a correção;
- «pode ser o mesmo estudo»: 2, contra 19.

**Base de equivalências rev66** (ajustes pedidos pelo usuário; a base fica fora do repositório):
- «DOPPLER DE TIREÓIDE»: o 1º item aceita 40901654 ou 40901203;
- punções: uma regra «um ou outro» (40809099 ou 40809161) para os 9 títulos;
- nova regra «DOPPLER DE MAMAS»: 40901114 + 40901386.

Com a base rev65 eram 809 linhas conferidas; com a rev66 e o motor da alpha.31, são 892.

## v3.0.0-alpha.40 — quadro da comparação 1 a 1 MV × laudo (pedido e prévia aprovada em 24/11/2026)
Prévia aprovada: `docs/prototipos/quadro-comparacao/` e https://claude.ai/artifact/QVrMBg97jwwCbyRW1V67js.
- A comparação da linha aberta virou um quadro marcado, como planilha: moldura e faixa de título («Comparação 1 a 1 · MV × laudo», com a linha do relatório e a do laudo), colunas MV | Laudo (Apolo) | Resultado, a diferença destacada e o resumo no rodapé («4 iguais · 1 diferença: Convênio»).

## v3.0.0-alpha.39 — médico do relatório na comparação MV × laudo (pedido de 24/11/2026)
- Na linha aberta da Conferência, a linha «Médico» agora mostra, do lado do MV, o prestador do relatório (código e nome do cabeçalho do PDF), e compara com o médico do laudo pelo cadastro e pelos aliases: «mesmo prestador» ou «outro médico».

## Correção da v3.0.0-alpha.34 — convênio com nome cortado no MV (pedido de 24/11/2026)
- Na linha aberta da Conferência (MV × laudo), «CISMEPAR - ULTRAMED» (MV) × «CISMEPAR - ULTRAMED CAMBE» (Apolo) aparecia como «diferente».
- O motor já tratava como o mesmo convênio (o MV corta o nome: um é o começo do outro); só a comparação da tela exigia o nome idêntico. Agora a tela usa a mesma regra e mostra «mesmo convênio (nome cortado no MV)».

## Correção da v3.0.0-alpha.28 — Enter nas confirmações (pedido de 24/11/2026)
- As caixas de confirmação abriam com o foco no «Cancelar», e o Enter num campo acionava o primeiro botão (também o «Cancelar»): o Enter nunca confirmava.
- Agora o Enter num campo aciona o botão principal (o último que não é «Cancelar»); sem campos, o foco começa no botão principal. Numa área de texto o Enter continua quebrando linha; Esc cancela. Teste: `test/ponta_a_ponta_ficticio.mjs`.

## Conferência: atendimento e ID do Apolo copiáveis — **IMPLEMENTADA na v3.0.0-alpha.35** (pedido de 24/11/2026; prévia: `docs/prototipos/atendimento-id-copiavel/` e https://claude.ai/artifact/2BzUnDxLEDWjcxe69iwPfJ)
- Na linha aberta da Conferência, o atendimento (em «Motivo / evidências» e na «Linha do MV») copia com um clique.
- O bloco «Laudo» sempre começa com o «ID Apolo» (coluna ID da planilha de laudos), também copiável. Conta e acesso ficam de fora (decisão do usuário).

## Conferência: rolagem, selecionar todos e copiar nome — **IMPLEMENTADA na v3.0.0-alpha.32** (pedido de 24/11/2026; prévia aprovada: `docs/prototipos/selecao-copiar-nome/` e https://claude.ai/artifact/K2GJK7qKJtxH1e6aemBqrZ)
- Abrir ou fechar uma linha da tabela não leva mais a lista de volta ao topo (vale para todas as tabelas).
- Caixa no cabeçalho marca/desmarca todas as linhas do filtro (com traço quando só algumas estão marcadas).
- Ícone ao lado do nome do paciente copia o nome com um clique, sem abrir a linha.

## Correção da v3.0.0-alpha.27 — tela estreita / celular (pedido de 24/11/2026)
- No celular, o menu lateral (232 px) deixava uns 260 px para a tela, e o quadro da competência empurrava a página para o lado (cartões cortados).
- Agora, em tela de até 900 px, o menu começa **recolhido** (só ícones); o ☰ abre. O topo e os textos longos quebram de linha. Teste: `test/menu.mjs`.
- Corrigido junto: o cartão «Roteiro deste relatório» sumia com o menu recolhido (a classe do cartão era a mesma do nome dos itens do menu).

## SOL-F51 — Roteiro da conferência por relatório — **IMPLEMENTADA na v3.0.0-alpha.26** (pedido de 23/11/2026; prévia aprovada: `docs/prototipos/roteiro-conferencia/` e https://claude.ai/artifact/8LEQjhxsQUBSNP2Xgdm1nB; teste: `test/roteiro.mjs`)
Base reaproveitável das prévias (CSS, menu e ícones do app): https://claude.ai/artifact/UL2uPLRxrDjUquvd5sjEgE.

**Como ficou:** o passo vem do motor (`roteiroDoRelatorio`, em `src/engine/64-roteiro.js`). Na Conferência, o cartão «Roteiro deste relatório» fica entre «O que conferir» e o resultado, com o botão do próximo passo; abaixo dos parâmetros, cada relatório da lista mostra o passo em que está (clicar escolhe o relatório). Um PDF novo (outro arquivo) depois da última rodada leva ao passo 4. «Resolvido no MV» ou NC em linhas que continuam no PDF conferido mantêm o passo 3 (com alerta, se o PDF novo ainda traz as linhas). O aceite com pendências justificadas segue para o envio.

O usuário se perde no ciclo «confiro na ferramenta, corrijo no MV, tiro o relatório de novo… e agora, rodo de novo?». Pedido: mostrar na Conferência o roteiro de cada relatório e o passo em que ele está.
- Seis passos:
  1. versão hospitalar no MV (PDF com valor total);
  2. conferir e decidir;
  3. corrigir no MV;
  4. gerar de novo e reconferir («Reler o PDF e conferir de novo»);
  5. aceite do relatório;
  6. versão final e envio.
- O passo é **calculado pelo que já existe**: PDF lido, rodadas, decisões, «Resolvido no MV» e NCs a corrigir, aceite, e-mail marcado no Fechamento. Nada a preencher a mais.
- Cada relatório da unidade mostra o passo («passo 4 de 6», «✓ enviado») em «O que conferir».
- **Versão final do MV** (sem a coluna de valor total e sem a %): o usuário tira, salva e envia por e-mail com a prévia de todas as unidades. A ferramenta **não precisa ler** esse PDF; o passo 6 só lembra de enviar e de marcar o e-mail. (Ainda não há exemplo do PDF final; se um dia for preciso lê-lo, pedir um exemplo.)
- Regras de negócio que mudam: nenhuma.
## Correções da v3.0.0-alpha.25 — achadas com os arquivos reais de 11/2026 (23/11/2026)
Arquivos enviados nesta sessão: relatórios do MV de 17771 (Matheus) e 6703 (Alexandre), da V3, e a planilha de laudos de 11/2026 (38.276 laudos). Os PDFs foram lidos com o total igual ao impresso (R$ 15.087,16 e R$ 12.059,00).
- **HM:** os números batem com a SOL-F46.
  - Alexandre: 30 HM de USG Unimed devidos (R$ 990,00) e 5 HM de raio-X a excluir (R$ 95,00).
  - Matheus: 9 HM de USG Unimed devidos (R$ 315,00), 85 HM de mamografia a excluir (R$ 5.168,00) e 4 exames base Bradesco substituídos pelos 5 pacotes.
- **Corrigido — instalação nova sem os médicos da V3:** num navegador novo, a configuração de fábrica não recebia as migrações, e o cadastro padrão da V3 (SOL-F46) não entrava. Os médicos caíam no Fechamento do IMG. Agora a instalação nova também passa pelas migrações.
- **Corrigido — Fechamento não avisava o HM a excluir do médico V3:** o cálculo da V3 só vê o que entra no pagamento, e o HM excluído não aparece lá. Agora o aviso sai para todos, com a regra certa da unidade:
  - unidade 5: «85 HM a excluir do MV (R$ 5.168,00), fora do valor: na V3 só o HM de USG Unimed é pago»;
  - demais unidades: «… fora da V3 nenhum HM é pago».
- **Não deu para validar com estes arquivos:** HM fora da V3 (os dois relatórios são da V3) e uso das equivalências (as equivalências validadas ficam no navegador e na pasta do usuário, não nos arquivos).

## SOL-F50 — Uso das equivalências nas conferências (trazer para a 3.0) — **IMPLEMENTADA na v3.0.0-alpha.24** (pedido de 23/11/2026; prévia e os 3 pontos aprovados; teste: `test/eq_uso.mjs`)
Função feita em 09/11/2026 na v2.1.0-alpha.20 (ramo `claude/determined-einstein-agz3lv`, «SOL-F41» na numeração antiga). Ela nunca entrou na `main`: a 3.0 começou da alpha.19. Precisa ser refeita sobre a 3.0.

**Prévia sem código:** `docs/prototipos/uso-equivalencias.html` (CSS, menu e ícones do app; dados fictícios).
- **Equivalências TUSS → nova subaba «Uso nas conferências»:**
  - quadros: em uso · paradas · nunca usadas · linhas confirmadas na competência;
  - filtros: relações ou regras compostas, **grupo USG/IMG** (novo), janela de «em uso» e busca;
  - tabela com linhas confirmadas, mini gráfico 08 → 11, última competência com uso, prestadores, Vl Repasse e quem validou; o detalhe mostra a conta por competência, os prestadores e as unidades.
- **Tirar a validação com o impacto à vista:** «Voltar a pendente» e «Desativar» mostram quantas linhas a equivalência confirmou (no total e na competência). Com uso, a justificativa é obrigatória e vai para o histórico.
- **Base de equivalências:** coluna «Uso nas conferências».
- **Motor:** cada linha da rodada guarda o id da equivalência. Nas rodadas antigas, ela é achada pelo par código × título. A conferência e o fechamento não mudam.

**Decisões aprovadas (23/11/2026) e como ficou:**
1. **Os dois computadores veem o mesmo uso.** Cada conferência registrada vira um **resumo por relatório** (competência × prestador × unidade × repasse), sem paciente, com as contagens por relação (chave código × título × escopo, igual nos dois navegadores) e por regra composta.
   - O resumo fica no navegador (`rm2.usoEquivalencias`) e na pasta da rede, em `01 - Sistema › Equivalências TUSS › uso_equivalencias.json`.
   - A junção é por relatório e vale o resumo mais recente, então não há conflito para escolher.
   - A sincronização roda depois de cada conferência e junto com a das equivalências.
2. **A retenção não apaga o histórico.** O resumo é guardado à parte. Ao abrir a ferramenta, o uso é tirado de todas as rodadas **antes** de a retenção resumir as antigas.
3. **«Em uso»** = usada nas últimas 3 competências (padrão; muda no filtro).

**Na tela:** Equivalências TUSS → **«Uso nas conferências»**:
- quadros clicáveis (em uso · paradas · nunca usadas · linhas confirmadas no mês, com o valor);
- filtros: relações ou regras compostas, **grupo USG/IMG** (relatórios de Curitiba entram nos dois), janela e busca;
- tabela com mini gráfico das últimas competências e detalhe por competência, prestadores e unidades;
- «Voltar a pendente» e «Desativar» com o impacto à vista; com uso, a justificativa é obrigatória e o histórico guarda «uso: N linha(s) nas conferências»;
- **Exportar uso (.xlsx)**: Leia-me, Relações (com a coluna Grupo) e Regras compostas.

Na **Base de equivalências** entram a coluna «Uso nas conferências», o uso no detalhe e o mesmo quadro de impacto. Cada linha de rodada nova guarda o id da relação (`eqId`); nas rodadas antigas, a relação é achada pelo par código × título.

## SOL-F45 — Estrutura padronizada das pastas na rede — **IMPLEMENTADA na v3.0.0-alpha.14** (pedido de 17/11/2026; guia em `como-usar-pastas.md`; teste: `test/estrutura_pastas.mjs`)

**Pedido do usuário:** padronizar a pasta raiz `App repasse médico`:
- `01 - Sistema` com os arquivos permanentes;
- uma pasta por ano (`02 - Repasse 2026`, `03 - Repasse 2027`…);
- 12 competências por ano (`2026-11 - Novembro`), todas com a mesma estrutura (01 a 08).

Ele pediu também: não mexer nas pastas da equipe (20%, 25%, anestesistas), «construa repasse 2027 baseando-se nesse novo método» e avisar e guiar quando algo precisar ser movido à mão. O que ele disse ao escolher: «essa pasta de relatório de prestador não precisa se preocupar pois é uma pasta onde eu salvo os arquivos depois de toda a conferência», ou seja, o PDF final para o médico, sem o valor total.

**Como ficou:**
- **Criar pastas:** «Criar pastas da competência», «de 2026» e «de 2027» criam a estrutura completa. Nada é duplicado.
- **Ler:** a ferramenta lê a estrutura nova e a antiga.
  - Na 05, só USG, IMG e Curitiba são lidas.
  - A unidade vem do nome da pasta, que é o nome da unidade.
  - A correção usa o nome do arquivo (`nome_unidade`).
- **Gravar:** os Excel vão para a estrutura nova (NCs na 02, correção na 01, conferência ao lado do PDF na 05), sem nunca substituir arquivo.
- **Arquivos permanentes:** a ferramenta usa `01 - Sistema` quando existe; senão continua na pasta antiga da raiz (para os dois não se separarem no meio da mudança).
- **Pastas manuais:** 06, 07 e 08 são só criadas; a ferramenta não grava nelas.
- **Saíram** os nomes de pastas configuráveis (cfg.pastas).
- **Pacote .zip** com os nomes novos.
- **A mudança dos arquivos atuais é manual,** guiada:
  - em Configurações → Pastas e em `como-usar-pastas.md`;
  - no Início, o cartão da pasta raiz mostra o que ainda está no lugar antigo.

**SOL-F39 e SOL-F10:** a SOL-F45 cobre o «pacote da competência controlando as pastas do mês», nas pastas que são da ferramenta. As pastas de relatórios aos prestadores, NFs e repasses avulsos ficam com a equipe, por decisão do usuário.

## SOL-F45 — Excel único da unidade × grupo (planilha de controle por unidade) — **IMPLEMENTADA na v3.0.0-alpha.17** (pedido de 19/11/2026; teste: `test/planilha_unidade.mjs`)

**Pedido:** «Na conferência cruzada, quando executo a conferência de um prestador posso gerar um Excel para controle e salvar na pasta da competência; posso conferir todos os relatórios da unidade ao mesmo tempo; posso gerar um único Excel com todos os prestadores conferidos? Assim poderei trabalhar com os filtros e manter uma planilha de controle, uma por unidade, por categoria (IMG, USG…).» Pasta: `09 - Planilhas de repasse conferidos › IMG › unidade` — planilha geral dos prestadores que produziram na competência, naquela modalidade e unidade.

**O que já existia:** Excel por prestador («Exportar Excel», gravado em `05 › USG | IMG › unidade`, ao lado do PDF) e a conferência em lote («Conferir os N relatórios filtrados»), sem planilha única.

**Como ficou:**
- **Conferência → filtro «Relatórios da unidade» + «Grupo»**: com os dois escolhidos, aparece **«Excel único: IMG · unidade N (k)»** ao lado do lote. Também em **Prestadores por unidade**, no título de cada unidade × grupo.
- **Um arquivo por unidade × grupo:** `conferidos_img_unidade_17_comp_11-2026.xlsx`, sempre baixado e, com a pasta conectada, gravado em `09 - Planilhas de repasse conferidos › IMG | USG › nome da unidade` (Curitiba: `09 › Curitiba`). Mesmo nome: grava « (2)», nunca substitui.
- **Abas:**
  - **Prestadores** — uma linha por prestador: situação (Aceito · Conferindo — faltam N decisões · Conferido sem aceite · Relatório sem conferência), aceite (quem e quando), laudos no Apolo, linhas e total do MV, **Devido · Aceito · Para pagamento · Pendente · NC · Excluído**, decisões que faltam, «Só no laudo» sem decisão, arquivo e última rodada. Entram também **quem laudou e não tem relatório** (situação de Prestadores por unidade: Gerar no MV, Sem cadastro…). Linha TOTAL da unidade.
  - **Conferência** — as linhas de todos os prestadores, com **Cód. prestador** e **Prestador** nas duas primeiras colunas e as demais no modelo de exportação escolhido (Configurações → Exportação). Filtro ligado.
  - **O que falta decidir** — com o prestador em cada linha.
  - **Por procedimento** — código TUSS somado na unidade, com os prestadores.
  - **Informações** — competência, unidade, grupo, relatórios e rodadas usados.
- **Como é montado:** cada relatório é conferido de novo na hora, com os parâmetros da última rodada dele na competência (unidade, tolerância, médico), a base de equivalências atual e as decisões registradas — as mesmas regras da conferência de cada prestador. **Não grava rodada nova.** Relatório sem conferência entra só na aba Prestadores.
- **Correção junto:** a `09 - Planilhas de repasse conferidos` começa com «Planilhas» e seria confundida com a `04 - Planilhas de conferência` na leitura da pasta (o Excel da 09 seria lido como planilha de laudos). A leitura agora ignora a 09. «Criar pastas da competência» cria a 09 com USG | IMG › unidades e Curitiba.

## SOL-F44 — Ajustes de uso pedidos em 17/11/2026 — **IMPLEMENTADA na v3.0.0-alpha.11** (teste: `test/pasta_por_aba.mjs`)

**Pedido do usuário:** «esses log de erro ocupa muito espaço, colocar em um alternante na parte inferior e deixar com bolinha de notificação quando o alternante estiver fechado. Nas pastas de correção, dentro da pasta de correção não precisa de subpastas; os arquivos ficam aqui organizados por nome_unidade. Outra coisa, um botão em cada aba para sincronizar com a pasta em questão […] assim sincroniza só a pasta em questão para não precisar reler todos os PDFs.»

1. **Avisos do Fechamento** («N prestador(es) laudaram na unidade X e não têm relatório»):
   - ficam num alternante no fim da tela, depois do conteúdo do fechamento;
   - fechado, mostra uma bolinha com a quantidade de avisos: vermelha se há prestador sem relatório, amarela nos demais casos;
   - aberto ou fechado, a escolha fica lembrada no navegador.
2. **Correção de prestador sem subpastas por unidade:**
   - «Criar pastas da competência» cria só `Competências › Comp_MM-AAAA › Correção de prestador`;
   - a unidade de cada PDF vem do nome do arquivo, no formato `nome_unidade`. O trecho depois do último «_» pode ser o código (`_17`, `_Unidade 4`, `_un10`) ou parte do nome da unidade (`_Cambe`);
   - as subpastas que já existem continuam sendo lidas, como organização antiga.
3. **«Sincronizar pasta» em cada aba.** Lê só a pasta daquela aba, sem as planilhas e sem a outra pasta. Aparece com a pasta raiz conectada, inclusive quando ainda não há PDF carregado.
   - **Conferência cruzada:** lê `Relatórios para conferência`.
   - **Correção de prestador:** lê `Correção de prestador`.

**SOL-F43 implementada na v3.0.0-alpha.6** (com a F42 e a maior parte da F41): classes de fechamento, abas, filtros, decisões em lote, «Resolvido no MV», observação por linha, reconferência com alertas e Fechamento só com Devido + Aceito. Guia: `como-usar-conferencia-oficial.md`.

Situação: SOL-F1 e SOL-F2 implementadas (v2.0.0-alpha.2); SOL-F3 implementada (v2.0.0-alpha.3); SOL-F4 implementada (v2.0.0-alpha.4); SOL-F6, SOL-F7 e SOL-F8 implementadas (v2.0.0-alpha.5).

## SOL-F49 — Descontos que mudam todo mês (lembrete) e lembrete do reajuste anual — **IMPLEMENTADA na v3.0.0-alpha.23** (pedido de 23/11/2026; prévia aprovada: `docs/prototipos/descontos-do-mes.html`; guia em `como-usar-fechamento.md`; teste: `test/descontos_variaveis.mjs`)

**Implementação (prévia aprovada em 23/11/2026, sem resposta às perguntas em aberto; adotados os padrões abaixo, todos editáveis na tela):**
- **Motor (`86-descontos.js`):** o desconto tem `variavel` e `onde`, e os valores do mês ficam em `lancamentos` (`{AAAA-MM: {valor, semDesconto, por, em}}`).
  - Sem lançamento, a parcela do mês é «a conferir» e entra como zero.
  - No Fechamento (`88-fechamento.js`), o prestador com desconto a conferir fica em **Verificar**, com aviso, até alguém lançar.
- **Reajuste anual:** `cfg.reajusteAnual = {mes, desde, feitos}`. O padrão é janeiro, a partir de 2027, porque o reajuste de 2026 é o cadastro de USG atualizado em 23/11/2026. A configuração compartilhada mescla esse campo item a item (mês, ano inicial, feitos).
- **Telas:**
  - Bases: «Descontos do prestador» com o valor «Fixo» ou «Muda todo mês», e o cartão «Reajuste anual».
  - Fechamento: cartão «Descontos do mês», com Lançar, «Sem desconto este mês» e Corrigir.
  - Início: «Pede você».
  - Menu: contagem em «Fechamento e envio».
- **Padrões adotados:** «Aplica em» começa em IMG (último dia útil); a pensão continua com valor fixo.

**Pedido do usuário:**
- Lembrete de descontos para três prestadores:
  - dois recebem **adiantamento direto da Unimed**;
  - um tem **plano de saúde** a descontar;
  - um deles também tem a pensão alimentícia (valor fixo).
- O valor muda todo mês e é conferido no **portal do convênio**. Por isso não dá para deixar fixo.
- Todos esses descontos são feitos no **repasse do fim do mês (dia 30)**, o pagamento do último dia útil.
- «A partir de agora e no ano que vem vou realizar reajuste anual.»

**Hoje:**
- O desconto parcelado (SOL-F31) exige valor fixo da parcela.
- Não há lembrete para conferir valores no mês nem para o reajuste anual.

**Proposta da prévia:**
1. **Bases → Descontos do prestador:** cada desconto tem o valor **Fixo** (como hoje; ex.: pensão) ou **Muda todo mês**. Nesse segundo caso:
   - não tem valor cadastrado;
   - tem o campo «onde conferir» (ex.: portal da Unimed);
   - o padrão de «Aplica em» é o **Repasse IMG (último dia útil)**.
2. **Fechamento e envio → Repasse IMG**, no cartão «Descontos do mês»:
   - o desconto que muda fica **a conferir**, com um campo para o valor visto no portal;
   - os botões são «Lançar» e «Sem desconto este mês», e fica registrado quem lançou e quando;
   - até ser lançado, o prestador fica com a pendência «desconto» e não aparece como pronto para enviar;
   - o valor lançado entra na coluna DESCONTOS;
   - o valor fixo continua automático.
3. **Início → O que pede atenção:** «Descontos a conferir no portal: N», com o prazo do pagamento, até todos serem lançados. O menu também mostra a contagem em «Fechamento e envio».
4. **Reajuste anual (Bases):**
   - mês do lembrete (sugestão: janeiro) e lista do que revisar: percentuais de USG, BOARD, valores do IMG, descontos fixos e regras da V3;
   - no mês, o Início mostra «Reajuste anual de AAAA» até alguém marcar «Reajuste de AAAA feito».

**Perguntas em aberto:**
- O que entra no reajuste anual e em que mês?
- Os três prestadores aparecem no Repasse IMG? Se não, o desconto não teria em qual linha entrar no dia 30.
- A pensão continua com valor fixo?

## Cadastro de USG pela planilha de controle: faixa «Repasse 42%» e residente que muda de faixa (23/11/2026, v3.0.0-alpha.23; teste: `test/cadastro_usg.mjs`)

Pedido: atualizar o cadastro de USG com a lista atual de prestadores por faixa (geral, acréscimo de 2%, residentes, 40%, 42%, 50%, 55% e 70%), quem recebe BOARD e um desconto mensal recorrente. A lista com os nomes **não** fica no repositório: vai como planilha no formato da planilha de controle, para importar em Bases → Prestadores → «Importar regras da planilha de controle».

Percentuais conferidos (já eram os do cadastro das unidades):

| Faixa | Unid. 1 | 2 | 4 | 7 | 10 | 17 |
|---|---|---|---|---|---|---|
| Médicos geral | 44% | 49% | 40% | 40% | 44% | 42% |
| Acréscimo de 2% | 46% | 51% | 42% | 42% | 46% | 44% |
| Residentes | 35% | 35% | 35% | 35% | 35% | 35% |
| 40%, 42%, 50%, 55%, 70% | fixo, independente da unidade (70%: só atuam na 17) |

O que mudou no motor (`45-regras.js`):
- **Faixa nova «Repasse 42%»** (fixa). Antes não existia: o bloco «REPASSE 42%» da planilha virava uma faixa sem cadastro, e o prestador ficava sem percentual esperado. Configurações antigas recebem as faixas padrão que faltam na posição do padrão, sem mexer nas que o usuário editou.
- **Residente que muda de faixa volta a médico** na importação. Antes continuava «residente» e o IMG usava a tabela de residente.

Limites da importação, mantidos:
- **BOARD:** é um valor fixo mensal em R$, lido da coluna BOARD. Célula vazia mantém o valor já cadastrado, e a importação nunca zera um BOARD.
- **Prestador fora da planilha:** continua com a faixa que tinha.
- **Descontos parcelados** (pensão, por exemplo) não vêm da planilha. São cadastrados em Bases → Prestadores e regras → Descontos parcelados, com o nº de parcelas vazio para recorrente.

## SOL-F47 — Vários USG do mesmo paciente no mesmo dia: o título do laudo desempata — **IMPLEMENTADA na v3.0.0-alpha.23** (pedido de 17/11/2026, entregue em 23/11/2026)

**Problema (reproduzido com dados fictícios):** paciente com USG de abdome total, transvaginal e tireoide no mesmo atendimento, sem equivalência validada para esses títulos. O pareamento escolhia o laudo pela ordem da planilha:
- o código do abdome total (40901122) ficava com o laudo de **tireoide**, e assim por diante;
- as três linhas viravam «Mais de um laudo plausível»;
- «O que falta decidir» propunha **validar pares errados** («Sem equivalência: «USG de tireoide» × 40901122»);
- faltando um dos laudos, a linha **que tinha laudo** podia ficar «Só no faturamento», gerando um **candidato a NC errado**.

**O que mudou** (motor `60-conferencia.js`, `54-titulos.js` e `61-causas.js`; as faixas e as regras de bloqueio não mudaram):
1. **Afinidade título × descrição do MV** (0 a 100%):
   - mede quanto do título do laudo aparece na descrição do procedimento no MV;
   - o nome do procedimento (antes do parêntese) pesa mais do que a lista de estruturas da descrição TUSS: «USG de abdome superior» fica mais perto de «US - ABDOME SUPERIOR» do que de «US - ABDOME TOTAL (ABDOME SUPERIOR, RINS…)»;
   - a palavra da modalidade (ultrassonografia, tomografia…) não conta, e sinônimos como mamária = mamas, renal = rins e pelve = pélvica são reconhecidos.
2. **Pareamento:** dentro da mesma faixa, o par de maior afinidade escolhe primeiro. Laudo com título validado para **outro** código fica atrás dos laudos sem cadastro. A ordem das linhas e da planilha deixa de importar.
3. **Ambiguidade:** quando o laudo escolhido tem afinidade de pelo menos **40%** e fica **25 pontos acima** de cada alternativa, a linha não é mais «ambígua». Ela ganha o marcador **«Laudo escolhido pelo título»**, com os percentuais no motivo.
   - A situação não muda: sem equivalência validada, a linha segue Pendente até validar a equivalência.
   - O desempate só vale onde a equivalência não decide (pendente, sem cadastro, título validado para outro código). Com equivalência validada, quem decide é a base, como antes. Par por **regra composta** também fica fora: o título da regra descreve vários procedimentos (ex.: «bolsa escrotal com Doppler» × a página só do Doppler de outro médico continua ambíguo, para você decidir quem laudou).
4. **«O que falta decidir»:** linha que **continua** ambígua e não tem equivalência (ou o título está validado para outro código) vai para a decisão linha a linha («Mais de um laudo plausível»), e não para «Cadastrar e validar a equivalência» em lote. Assim um par que é palpite não vira equivalência validada.
5. **Detalhe da linha:** cada laudo candidato mostra «título N%».

**Critérios de aceite** (`test/usg_mesmo_dia.mjs`, dados fictícios):
- 3 USG no mesmo dia sem equivalência → cada linha com o laudo do seu exame, sem «ambíguo», em qualquer ordem;
- falta o laudo de um exame → é a linha desse exame que fica «Só no faturamento»;
- abdome total × aparelho urinário (o abdome também cita os rins) → cada um com o seu laudo;
- títulos que não dizem o exame («Exame de imagem») → continuam ambíguos e vão para a decisão linha a linha;
- equivalências validadas ou pendentes já cadastradas → resultado igual ao de antes;
- duas linhas do mesmo código e um laudo → a 2ª continua «Só no faturamento» (bilateral fica para a próxima melhoria).

**A conferir com os relatórios reais:** os testes com a pasta `dados/` (`motor`, `e2e`, `competencia10`, `conferencia_causas`…) não rodaram no ambiente desta entrega. Vale rodá-los e comparar a quantidade de «Mais de um laudo plausível» antes e depois.

## SOL-F43 — Prévia de conferência vira a conferência oficial: só o Devido e o Aceito compõem o fechamento — **IMPLEMENTADA na v3.0.0-alpha.6** (pedido de 13/11/2026; guia em `como-usar-conferencia-oficial.md`)

**Consolida a SOL-F41 e a SOL-F42** num plano só, e responde à pergunta que estava em aberto: **pendente de análise NÃO compõe o fechamento.**

**Diretriz do usuário:**
- A ferramenta centraliza as decisões, registra as justificativas, controla as correções e determina quais procedimentos estão autorizados a compor o fechamento.
- O fechamento reflete **exclusivamente** o que é devido ou expressamente aceito, **nunca** simplesmente tudo o que consta no relatório do MV.

### 1. Classificação de cada procedimento (linha do MV) e o que já existe por trás de cada uma

**Princípio de implementação: não criar um motor novo.** As quatro classes são uma **leitura** da situação da conferência mais as decisões que já existem. As regras do motor (faixas, equivalências, regras compostas, exame) não mudam.

| Classe (nova, na tela e no fechamento) | Entra no fechamento? | Vem de (o que já existe) |
|---|---|---|
| **Devido** | **sim** | situação «Conferido» (par único, nome seguro, mesma data, equivalência validada ou regra composta/exame) |
| **Aceito** | **sim** | decisão «Considerado no repasse», que passa a se chamar **«Aceito para pagamento»**. Justificativa obrigatória, com quem e quando. Vale para a linha e para os grupos de «O que falta decidir» («Aceitar as N», «Considerar no repasse») |
| **Não conformidade** | **não** | decisão «Tratado: NC» (NC registrada e não «não procede»). Na reconferência entra a SOL-F42: aguardando, corrigida ou não corrigida no MV, com alerta |
| **Pendente de análise** | **não** | tudo o que não é nenhuma das anteriores: ressalva sem decisão, pendente/ambíguo, só no faturamento, equivalência não validada, composição incompleta, «Resolvido no MV» ainda não confirmado… |
| **Excluído (não compõe repasse)** | **não** | item não procedimental: taxa, material e medicamento sempre; HM quando a regra do prestador não o inclui (sinalizado «Excluir do MV») |

Laudos «Só no laudo» não têm valor no MV e não entram na conta do fechamento. Eles continuam nas decisões (NC, correção de prestador, dispensar).

**Decisões do usuário (13/11/2026):**
- **a) «Conferido com ressalva»** (convênio escrito de outro jeito, data na tolerância, composição com observação) é **Pendente de análise** até ser **aceito** («Aceito para pagamento»). Só «Conferido» é Devido direto. O aceite em lote por causa («Aceitar as N (mesmo convênio)») continua sendo o caminho rápido.
- **b) Itens não procedimentais e HM:**
  - **Taxa, material e medicamento nunca compõem o repasse,** em nenhuma situação. Classe nova **«Excluído (não compõe repasse)»**:
    - fora do fechamento;
    - não é pendência e não precisa de decisão;
    - mostrado só no total «Excluído do fechamento».
  - **HM só compõe** quando a **regra do prestador** indica (hoje: V3 — HM de USG/Doppler do convênio Unimed — e as regras de repasse do prestador em Bases). Nesse caso o HM é Devido.
  - **HM sem regra que o inclua:**
    - não entra no fechamento;
    - é sinalizado **«Excluir do MV»** (lista própria);
    - **na reconferência, se o HM continuar no novo PDF, a ferramenta notifica** para ser excluído, no mesmo mecanismo do alerta de NC que continua no MV (F42).
  - **Pacote / agrupador e «Desconhecido»** (classificação pendente) continuam **Pendente** até alguém decidir ou cadastrar a regra de classificação. Não houve decisão do usuário sobre esses dois; a proposta é manter assim.
- **c) «Resolvido no MV»** fica **Pendente** até:
  - a ferramenta **reconferir** e confirmar (a linha sumiu ou foi corrigida no novo PDF);
  - **ou** o usuário **aceitar manualmente** («Aceito para pagamento»).

**Classes finais:** Devido · Aceito · Não conformidade · Excluído (não compõe repasse: taxa, material, medicamento, HM sem regra) · Pendente de análise.
- **Valor para pagamento = Devido + Aceito.**
- **Conferência da soma:** Devido + Aceito + NC + Excluído + Pendente = total do relatório do MV.

**Protótipo visual (sem código da ferramenta):** `docs/prototipos/conferencia-oficial.html`. Abre no navegador, com as abas, os totais por classe, os filtros, o card da linha com observação e decisões, a reconferência e o aceite do relatório. Os dados são fictícios.

### 2. A prévia como ambiente oficial
- **Totais sempre visíveis** no topo:
  - **Devido R$** · **Aceito R$** · **= Valor para pagamento R$**;
  - ao lado, **Pendente R$** (falta decidir) e **NC R$** (excluído);
  - **Excluído R$** (taxas, materiais, medicamentos, HM sem regra);
  - e o total do MV, para conferir que a soma bate (Devido + Aceito + Pendente + NC + Excluído = total do relatório).
- **Classe por linha** na tabela, em coluna própria, com filtro por classe. Também entram os filtros da SOL-F41: procedimento, data, convênio, título, médico e com observação, com ações em lote sobre o filtrado.
- **Decisões na própria tela**, sempre com justificativa e rastreabilidade:
  - Aceitar para pagamento;
  - Registrar NC;
  - Resolvido no MV (F41);
  - Escolher o laudo certo (F41);
  - Dispensar laudo (já existe);
  - Observação (F41).
- **Reconferência** (F42): ao importar o novo PDF, a ferramenta mostra:
  - as NCs corrigidas;
  - as NCs que continuam no MV (alerta, com o valor que continua sendo pago pelo MV);
  - os «Resolvidos no MV» confirmados e os não confirmados;
  - os **HM sinalizados para exclusão que continuam no MV**.
- **«Aceite do relatório»** (o que hoje é «Registrar aceite») continua sendo o **encerramento** da conferência do relatório, e não a aprovação de linhas. Os nomes ficam distintos para não confundir: «Aceito para pagamento» é a linha; «Aceite do relatório» é o fechamento da conferência.
  - Com pendências, o aceite do relatório continua permitido com observação. As linhas pendentes **não entram** no valor.

### 3. Fechamento
- O valor de cada prestador × unidade passa a ser **Devido + Aceito** da rodada com aceite do relatório (ou da última, como prévia), e não mais a soma de todas as linhas (`88-fechamento.js`, `somaLinhas`). A mesma regra vale para:
  - a produção de USG e a classe A/B/C/D;
  - a contagem de exames da V3/Curitiba;
  - a planilha de controle;
  - a prévia do e-mail.
- **Coluna/aba com o valor aberto por classe** (Devido, Aceito, Pendente, NC), com a lista das linhas, para conferir.
- **Sem quebrar o que já existe:**
  - **Competências fechadas e rodadas antigas** mantêm o cálculo antigo (total do MV). A regra nova vale para as rodadas feitas a partir da versão que a implementar, e a rodada guarda qual regra usou (`versoes.motor`).
  - Na competência aberta, a regra nova vale ao **conferir de novo**. Até lá, o Fechamento mostra o aviso «calculado pela regra antiga: confira de novo».
  - Decisões já registradas («Considerado no repasse», NCs, «Dispensado») continuam valendo e já se encaixam nas classes novas: considerado = Aceito, NC = Não conformidade.

### 4. Navegação por abas na Conferência
O resultado da conferência hoje é uma página longa: frase e barra, Detalhes da rodada, «O que falta decidir», Aceite, Linhas (a prévia), Candidatos a NC e Equivalências desta rodada. Passa a ter uma barra de abas fixa no topo do resultado:

| Aba | Conteúdo |
|---|---|
| **Prévia de conferência** (padrão, em destaque) | totais por classe, tabela de linhas com classe, filtros e ações |
| **O que falta decidir** | as causas agrupadas, como hoje, com o número de decisões no rótulo |
| **NCs e correções no MV** | candidatos a NC, NCs desta rodada e status da correção no MV (F42) |
| **Aceite do relatório** | quadro do aceite, com o resumo Devido/Aceito/Pendente/NC |
| **Detalhes e equivalências** | detalhes da rodada, comparação com a anterior e equivalências desta rodada |

- A aba escolhida fica lembrada durante a sessão.
- As decisões tomadas em qualquer aba atualizam os totais na hora.
- Os botões de ir direto («Começar pelas decisões», «Ir para o aceite») trocam de aba em vez de rolar a página.

### 5. Critérios de aceite
1. Num relatório com linhas conferidas, aceitas, com NC e pendentes, o topo mostra os quatro valores. **Valor para pagamento = Devido + Aceito**, e a soma das quatro classes = total do MV.
2. O Fechamento do prestador usa o Valor para pagamento da rodada, não o total do MV. A planilha de controle e a prévia do e-mail mostram o mesmo número.
3. Aceitar uma linha (ou um grupo) move o valor de Pendente para Aceito na hora, com justificativa, quem e quando.
4. Registrar NC move o valor para NC (excluído). «Não procede» devolve a linha para a classe anterior.
5. Reimportar o PDF: NC que continua no MV → alerta com o valor; NC que sumiu → «corrigida no MV».
6. Competência fechada antes da mudança: o Fechamento continua com os mesmos valores de antes.
7. As abas trocam sem recarregar; a «Prévia de conferência» abre primeiro, logo depois de conferir.

### Ordem sugerida de implementação
1. Classes e totais na prévia (só leitura, nada muda no fechamento): dá para validar com os relatórios reais.
2. Abas na Conferência.
3. Decisões novas da F41 (Resolvido no MV, escolher o laudo, filtros, lote, observação).
4. Fechamento pela regra nova, com a proteção das competências antigas.
5. Reconferência e alertas de NC (F42).

## SOL-F42 — NC sai do cálculo do fechamento e reconferência confirma a correção no MV — **IMPLEMENTADA na v3.0.0-alpha.6** com a SOL-F43 (pedido de 13/11/2026); na v3.0.0-alpha.9, a reconferência passa a mostrar também a NC «não lançado» que o MV lançou depois

**Princípio (do usuário):** «a ferramenta precisa ser o reflexo fiel do que realmente está sendo pago ao prestador. Não basta identificar uma divergência: é necessário garantir que ela tenha sido tratada e que o cálculo do fechamento considere somente os procedimentos efetivamente devidos.»

**Fluxo descrito pelo usuário** (ex.: exame lançado na conta do MV, sem laudo no Apolo):
1. Investigar nos sistemas.
2. Confirmado que não há laudo → **registrar a NC na ferramenta**.
3. No MV, **retirar o procedimento** da conta do paciente.
4. Na ferramenta, o registro continua como NC e **deixa de compor a base de cálculo do fechamento**.
5. Gerar um novo PDF, importar e conferir de novo. A ferramenta **confronta com os registros anteriores** e verifica se as NCs foram corrigidas.
6. Se um procedimento com NC **ainda estiver no novo relatório**, a ferramenta **alerta**: não foi retirado do MV e continua compondo a produção que será paga.

**Como funciona hoje (conferido no código):**
- **Valor:** o Fechamento soma **todas** as linhas da rodada (com aceite ou a última), inclusive as que têm NC (`88-fechamento.js`, `somaLinhas`).
- **Decisão «Tratado: NC»:** fica na memória da competência pelas chaves da linha, sem nome de paciente (`84-decisoes.js`). Na nova rodada, se a linha **continua** no MV, ela aparece como «Tratado: NC» e **não há alerta**. Se a linha saiu, o laudo aparece como «Só no laudo», reconhecido como NC.
- **Comparação de rodadas:** já existe (passaram a conferido, continuam pendentes, saíram da extração…), mas não olha as NCs.

### O que fazer
1. **NC fora do valor.**
   - Linha do MV com NC registrada (natureza que significa «não devido»: não lançado/sem laudo, lançamento indevido, prestador incorreto…) **sai da base de cálculo** do fechamento do prestador: Vl Repasse, produção de USG e classe.
   - NC «não procede» volta para o valor.
   - Quais naturezas tiram do valor fica configurável em Configurações → Conferência. As que **não** tiram (ex.: só informativa) continuam somando.
2. **Status da correção no MV, por NC.** Estados:
   - **Aguardando correção no MV:** registrada, e a linha ainda está no último relatório importado;
   - **Corrigida no MV:** a linha não aparece mais no relatório reimportado; data da rodada que confirmou;
   - **Não corrigida, com alerta:** reimportou depois do registro e a linha continua lá.
   - A NC guarda a rodada em que foi registrada e a rodada que confirmou a correção (rastreabilidade).
3. **Alerta na reconferência.** Ao conferir de novo um relatório do mesmo prestador × unidade na competência, a ferramenta compara as linhas com NC pela chave da linha: conta, atendimento, código e data. O alerta aparece:
   - no resultado da conferência: cartão vermelho «N procedimento(s) com NC continuam no MV — R$ X ainda compõem a produção», com a lista e um link para cada NC;
   - em «O que falta decidir», como causa própria, com ações «Retirar do MV e reimportar» (só lembrete) ou «Não procede» (a NC estava errada);
   - no Fechamento: aviso no prestador e bloqueio do aceite sem observação;
   - na aba Não conformidades: filtro «aguardando correção no MV» e «não corrigidas».
4. **Fechamento fiel ao que será pago.** Por prestador, o valor aberto por situação: conferido, considerado no repasse, **NC (fora do valor)**, dispensado e pendente. Uma NC que continua no MV aparece destacada, porque a ferramenta tira do valor, mas o MV ainda vai pagar.
5. **Sem planilha.** NC, retirada no MV, reimportação e confirmação acontecem na ferramenta. O Excel só leva uma cópia.

### Critérios de aceite
1. Registrar NC numa linha «Só no faturamento» tira o Vl Repasse dela do Fechamento do prestador (e da produção de USG), e a planilha de controle mostra o valor sem ela.
2. Reimportar o PDF sem o procedimento → a NC passa a «Corrigida no MV», com a data da rodada.
3. Reimportar o PDF **com** o procedimento ainda lançado → alerta na conferência, no Fechamento e na aba NCs, com o valor que continua compondo a produção.
4. NC marcada «não procede» → a linha volta a somar no valor.
5. Tudo sem nome de paciente nas chaves; histórico com quem registrou, quem confirmou e quando.

### Ligações
- **SOL-F41:** filtros, observação, «Resolvido no MV», considerar em lote e Fechamento aberto por situação. O «Resolvido no MV» da F41 e o status de correção da F42 usam o **mesmo mecanismo** de confirmação na rodada seguinte.
- **Pergunta da F41 (pendente sai ou não do valor): respondida na SOL-F43.** Pendente de análise **não** compõe o fechamento.

## SOL-F41 — Conferência autossuficiente: filtros na tabela e observação por linha — **IMPLEMENTADA**: a maior parte na v3.0.0-alpha.6 com a SOL-F43; «Exportar só o filtrado» e reconferir em um clique na alpha.10; o restante na alpha.13 (pedido de 13/11/2026)

**O que entrou na v3.0.0-alpha.13** (teste: `test/f41_conferencia.mjs`):
- **Filtros novos:** título do laudo, médico do laudo, intervalo de datas («Data» + «até») e observação («Com» ou «Sem»).
- **Em lote, sobre o filtrado:**
  - «Dispensar os N laudo(s) «Só no laudo»…»;
  - «Observação nas N linha(s)…».
- **Observação:**
  - coluna «Observação (na linha)» no Excel, com autor e data, no catálogo e no fim do modelo «Padrão»;
  - «N linha(s) com observação» no quadro do aceite;
  - vai para as Observações da NC registrada a partir da linha (e em lote);
  - segue a retenção das NCs (`retencaoNC`): passado o prazo, o texto é apagado e ficam quem escreveu e quando.
- **Decisão do usuário (17/11/2026):** a observação é **só interna**. Não vai para o e-mail nem para a prévia do prestador no Fechamento.


**Pedido do usuário:** «gostaria de filtros nessa prévia de conferência para poder trabalhar com procedimentos, datas específicas; dentro desse card que especifica a situação do paciente que clique quero um campo de observações para que eu possa colocar algo. O intuito é tornar a ferramenta autossuficiente para que eu não precise exportar o Excel e conferir à parte, pois os ajustes feitos na planilha Excel não entram no app, aí não gera as não conformes e cálculo de produção, fechamento.»

**Problema:** a conferência ainda é finalizada no Excel. O que se ajusta na planilha não volta para a ferramenta. Com isso:
- as NCs não nascem;
- a produção e a classe não usam o ajuste;
- o Fechamento fica com o resultado sem os ajustes.

O Excel deve virar só uma cópia do que foi feito no app, não o lugar do trabalho.

**O que já existe na tabela de linhas (Conferência → Linhas)**, para não duplicar:
- busca livre (paciente, código, título, médico);
- filtro por situação (cartões Conferido, Pendente…);
- filtro por marcador (ressalvas e decisões);
- «só o que falta decidir»;
- «Ver todas as linhas».

No detalhe da linha:
- motivo e evidências, candidatos, linha do MV e laudo;
- botões «Apontar como NC…», «Considerar no repasse…» e «Dispensar laudo…».

### 1. Filtros na tabela de linhas
- **Procedimento (código TUSS do MV):** lista dos códigos presentes no relatório, com descrição e quantidade de linhas; escolha de um ou vários.
- **Data:** um dia específico ou um intervalo (de… até…); atalho para os dias presentes no relatório.
- Também úteis no mesmo painel:
  - convênio;
  - título do laudo (Apolo);
  - médico do laudo;
  - «com observação» / «sem observação».
- Os filtros combinam entre si e com os que já existem (situação, marcador, busca, só o que falta).
- No topo do resultado, aparecem a **quantidade de linhas e a soma do Vl Repasse do filtro**.
- Botão «Limpar filtros» (já existe) passa a limpar todos.
- Os filtros ficam enquanto a conferência está aberta na sessão.
- **Ações em lote sobre o que está filtrado:** «Considerar no repasse», «Apontar como NC», «Dispensar laudos» e «Observação» para as linhas visíveis, com confirmação e a contagem.

### 2. Observação por linha (no card de detalhe)
- Campo de texto livre no card da linha, com «Salvar».
- A observação guarda:
  - quem escreveu (operador);
  - data e hora;
  - histórico de alterações (editar não apaga o texto anterior).
- **Fica na competência**, como as decisões («memória das decisões», SOL-F6): vale para toda nova rodada do mesmo relatório. A chave da linha não leva nome de paciente.
- Se o texto tiver dado de paciente, a observação segue a mesma retenção das NCs (`retencaoNC`).
- **Onde aparece:**
  - ícone na tabela;
  - filtro «com observação»;
  - coluna «Observação» no Excel (catálogo de colunas e modelo «Padrão»);
  - no quadro do aceite («N linhas com observação»);
  - levada para a NC quando a linha virar NC.
- A observação **não muda a situação** da linha. Para mudar a situação, continuam as decisões (NC, considerar, dispensar).

### 3. Tudo o que hoje se ajusta no Excel deve existir no app
Para fechar o ciclo (conferência → NCs → produção → fechamento), cada ajuste feito hoje na planilha precisa de uma ação equivalente na ferramenta, que alimente os outros módulos.
- **A levantar com o usuário:** a lista dos ajustes que ele faz hoje no Excel depois de exportar. Exemplos a confirmar:
  - marcar uma linha como certa;
  - anotar o motivo;
  - excluir uma linha da produção;
  - mudar o médico;
  - ajustar o valor;
  - separar o que vai para NC.
- Cada ajuste vira:
  - uma decisão que já existe (NC, considerar no repasse, dispensar);
  - ou uma decisão nova (ex.: «não entra na produção», «valor ajustado» — sem alterar o dado original do MV, só registrar o ajuste com justificativa);
  - ou uma observação.
- O Fechamento e os indicadores de produção passam a ler essas decisões. Hoje o Fechamento usa o valor do relatório do MV e só conta as pendências.

### 3.1 Respostas do usuário (13/11/2026) e o que isso significa
**Como é feito hoje, fora da ferramenta:**
- As **ambiguidades** são conferidas, **resolvidas no MV** e marcadas como «resolvido» na planilha.
- Procedimentos são **considerados** na planilha quando convém, **sem dar aceite** na ferramenta.
- «Ajuste de valor» = um procedimento considerado na planilha, mas sem aceite na ferramenta, que por isso não aparece no fechamento do app.

**Como a ferramenta calcula hoje (conferido no código, `88-fechamento.js`):**
- **O valor:** o Fechamento soma **todas** as linhas do relatório do MV da rodada com aceite (ou da última rodada, se não houver aceite), sem olhar a situação da linha. Ambíguas e pendentes entram no valor.
- **O efeito de não ter aceite:**
  - o prestador fica na situação **«Verificar»**;
  - a planilha de controle sai como **PRÉVIA**;
  - as decisões tomadas só no Excel (resolvido, considerado) não viram NC nem indicador.
- **Conclusão:** não é um «ajuste de valor» que falta. O que falta é **registrar na ferramenta** o que hoje é decidido no Excel e **dar o aceite**.

**O que entra na SOL-F41 por causa disso:**
- **Nova decisão «Resolvido no MV»** para linhas ambíguas ou pendentes:
  - com observação obrigatória («o que foi corrigido no MV»);
  - deixa de ser pendência;
  - na próxima extração/rodada, a ferramenta confere se a correção apareceu e avisa se não apareceu (a comparação de rodadas já existe).
- **«Escolher o laudo certo»** na linha ambígua: um clique em um dos candidatos resolve o par, com registro de quem escolheu.
- **«Considerar no repasse» em lote** pelas linhas filtradas (item 1). É o equivalente, na ferramenta, do «considerado» da planilha.
- **Fechamento transparente:** em cada prestador, mostrar valor do relatório, valor conferido, valor considerado, valor pendente e valor dispensado/NC, com a lista das linhas. Assim fica claro o que entra e o que falta decidir antes do aceite.
- **Aceite como último passo da conferência na tela:** com tudo resolvido, «Registrar aceite» não pede observação. A planilha de controle deixa de ser PRÉVIA para aquele prestador.

**Pergunta nova (decide a regra de cálculo):**
- Linha que **ficou pendente** (sem resolver e sem considerar) deve **sair do valor** do fechamento, pagando só conferido + considerado?
- Ou o fechamento paga o **total do MV** e a pendência só impede o aceite, como hoje?

### Critérios de aceite
1. Filtrar por um procedimento e por um dia mostra só essas linhas, com contagem e soma; as ações em lote valem só para elas.
2. A observação digitada no card continua lá depois de rodar a conferência de novo, aparece no Excel e no filtro «com observação», e tem autor e data.
3. Uma conferência pode ser terminada, com NCs registradas e aceite, sem abrir o Excel. O Fechamento reflete as decisões tomadas na tela.
4. Ambiguidade resolvida no MV é registrada como «Resolvido no MV» e não bloqueia o aceite. Na rodada seguinte, a ferramenta diz se a correção apareceu.
5. O Fechamento mostra, por prestador, quanto do valor é conferido, considerado, pendente e dispensado/NC.

### Perguntas em aberto
- ~~Quais ajustes são feitos hoje na planilha?~~ Respondido em 13/11 (item 3.1).
- ~~A observação deve ir para o e-mail/prévia do prestador no Fechamento, ou é só interna?~~ Respondido em 17/11: só interna.
- ~~Ajuste de valor existe?~~ Respondido em 13/11: é consideração sem aceite (item 3.1). Fica a pergunta nova do item 3.1 (pendente sai ou não do valor).

## SOL-F4 — Competência no topo, válida para todas as abas — IMPLEMENTADA na v2.0.0-alpha.4

Pedido de 30/10/2026: «ter um controle por competência, assim todas alterações, correções ficam encapsuladas». Guia em `como-usar-competencia.md`.
- Seletor único no topo das abas de trabalho (não aparece em Bases, Equivalências e Configurações, a pedido do usuário); começa no mês atual e lembra a escolha. Fluxo mensal e NCs perderam o ‹ › próprio.
- Por competência: rodadas (e a comparação antes × depois), NCs, candidatos a NC, fluxo, anotações.
- Bases e equivalências: únicas para todas as competências (decisão do usuário). Cada alteração registra a competência e quem fez; a validação de equivalência guarda a competência no histórico.
- Aviso quando MV, Apolo ou Power BI carregado não é da produção esperada (competência − 1). Não bloqueia.
- Fechar competência (decisão delegada: «faça o que for melhor»): somente leitura para rodadas, NCs e fluxo; «levar para a seguinte» e exportações continuam; reabrir exige justificativa. Pacote .zip para a rede: NCs, fluxo, rodadas e resumo.

Registrado em 29/10/2026 a partir da conversa com o usuário. Referência visual atual: Microsoft To Do (listas por tipo de repasse).

## SOL-F1 — Aba «Fluxo mensal» — IMPLEMENTADA na v2.0.0-alpha.2

Especificação final em `especificacao-fluxo-mensal.md`; guia em `como-usar-fluxo-mensal.md`. Decisões de 29/10/2026: 15º dia útil (não dia 15) para NCs de USG e início do IMG; NCs não bloqueiam o IMG; pagamento de IMG, Curitiba e Sedação no último dia útil; só feriados nacionais; rodada vinculada nunca conclui etapa sozinha; «Fluxo mensal» por extenso, «Fluxo» só onde não couber.

### Requisito original

Nome aprovado pelo usuário: **Fluxo** (substitui as sugestões «Fechamento» / «Checklist do repasse»). Motivo: acompanhar, cadastrar e manter fluxos.

O que a aba precisa fazer:
- **Cadastrar fluxos** (modelos): cada tipo de repasse com suas unidades, prestadores e etapas. Tipos vistos no To Do: PET, 25% Dra. Mariana, 20% Dr. Paulo, Ecodoppler, USG, V3, IMG, Sedação unidades. Listas de projeto/avulsas: Correção de prestador unidades, Rep. de Dacrio Dr. Thales.
- **Manutenção de fluxo**: editar, desativar e versionar os modelos sem perder o histórico das competências já feitas.
- **Acompanhar** cada competência: gerar o checklist do mês a partir dos modelos; itens por unidade × prestador com etapas («0 de 5»), notas, destaque e concluídos.
- Etapas padrão propostas (a confirmar): extrair MV → conferência cruzada → correção de prestador → corrigir no MV → nova extração/reconferência → aceite → enviar ao prestador → planilha interna.
- Etapas feitas no app se marcam sozinhas a partir das rodadas (conferência, correção, aceite), com link para a rodada.
- Regras fixas por lista (ex.: «Não repassar UNIMED anestesistas unidades 17 e 2») ficam como aviso fixo, não como tarefa.
- **Controle de não conformidades por período**: o Fluxo acompanha as NCs encaminhadas por prazo. Exemplo dado: repasse de USG — não conformidades encaminhadas **até o dia 15**.
- Painel do mês: progresso por tipo, etapas atrasadas, prazos, dias de antecedência na entrega ao Financeiro.

Aguardando do usuário:
1. Tipos de repasse e, em cada um, unidades e médicos (prints das listas do To Do).
2. Etapas de cada tipo, se diferentes das padrão.
3. Prazos de cada tipo (USG até o dia 15; demais a informar).
4. Se mais alguém usará (hoje os dados ficam só no navegador).

## SOL-F2 — Anotações — IMPLEMENTADA dentro do Fluxo mensal (anotações por competência e observações por seção)

### Requisito original

Hoje o usuário usa bloco de notas e anotações soltas no e-mail.
- Área de anotações **junto do Fluxo ou separada** (decidir na prévia).
- Proposta: notas livres com data, busca, e vínculo opcional a competência, tipo de repasse, item do fluxo, prestador ou não conformidade.

## SOL-F3 — Aba «Não conformidades» — IMPLEMENTADA na v2.0.0-alpha.3

Guia em `como-usar-nao-conformidades.md`. Decisões de 30/10/2026 (prévia aprovada):
- Situações: Aberta → Enviada ao Qualiex → Em tratativa → Regularizada · Não procede.
- Natureza: lista fixa + detalhe livre + observações. Na importação, o texto original vai para as observações.
- Responsáveis: cadastro de faturistas em Bases (manual, planilha com escolha de coluna ou Power BI com a coluna de quem fechou a conta), usado nos indicadores.
- Qualiex aceita qualquer formato de planilha: a exportação mantém as três abas da planilha manual + situação, observações e aba de indicadores.
- Dados de pacientes: só no navegador; nome e ID/atendimento apagados 60 dias após o registro (parâmetro em Configurações). As exportações críticas o usuário guarda na rede.
- MedicalShare: nome antigo no Apolo da unidade 17 (Palhano, faturada pela AlphaSonic Londrina), cadastrado como nome do Apolo da unidade 17.
- Na conferência cruzada, o que pode ser NC aparece como candidato para o usuário apontar manualmente; nada vira NC sozinho.

### Requisito original

Aprovada pelo usuário como aba específica.
- Na **conferência** (e na correção de prestador), o usuário **aponta** quais registros são não conformidade; o sistema já separa os candidatos (só no faturamento, só no laudo, prestador divergente etc.).
- Cada NC registra: tipo, linha de origem (sem alterar dados), valor envolvido, **responsável pelo fechamento da conta** (indicado pelo usuário), prazo, situação e verificação na competência seguinte.
- **Exportação em planilha com indicadores** para encaminhar ao **Qualiex** (registro de não conformidade).
- Ligação com o Fluxo: NCs encaminhadas por período e prazo (ex.: USG até o dia 15).
- Indicadores candidatos (vindos da página do Notion «Projetos e indicadores»): quantidade e valor por tipo de divergência, por unidade, por prestador, por responsável; reincidência; tempo até a regularização.

Pendências de definição: tipos oficiais de NC usados no Qualiex, campos exigidos pelo Qualiex, lista de responsáveis possíveis.

## Ordem sugerida

1. Prévia visual do Fluxo (com anotações) e da aba Não conformidades.
2. Não conformidades (aproveita a conferência que já existe).
3. Fluxo + anotações.

## SOL-F5 — Equivalências compostas e por convênio — IMPLEMENTADA na v2.1.0-alpha

Pedido de 30/10/2026: um laudo pode corresponder a mais de um código na conta, e isso pode variar por convênio.
- Exemplo: «USG de ombro com doppler» não corresponde ao articular sozinho. Na conta, precisa de um **articular + um doppler**; na **UNIMED, só o doppler**.
- Hoje o motor trata «o mesmo título validado para dois códigos» como **conflito**, e a conferência pareia um laudo com uma linha só. A segunda linha (o doppler) fica «Só no faturamento».
- O que precisa existir:
  - **relação composta** (título → conjunto de códigos esperados);
  - **variação por convênio** (ex.: UNIMED = só doppler);
  - conferência que aceite **um laudo sustentando N linhas** da composição e aponte o código que falta ou que sobra.
- Até lá, «desfazer conflito» (SOL-F8) resolve escolhendo um código.

## SOL-F6 — Memória das decisões por linha na competência — IMPLEMENTADA na v2.0.0-alpha.5

Pedido de 30/10/2026.
- **Fluxo:** a conferência mostra a prévia, você aponta a NC, retira o procedimento do relatório no MV e roda de novo. A ferramenta precisa lembrar que aquela falta é uma **NC já registrada**.
- **Linha divergente aceita:** o procedimento não bate, mas por razão específica entra no repasse. Fica como **aceite manual da linha**, com justificativa, e conta como resolvido no fechamento.
- **Escopo:** as decisões ficam na competência, sobrevivem a novas rodadas e aparecem no aceite e no fechamento.

## SOL-F7 — Fechamento do repasse: planilhas e indicadores — IMPLEMENTADA na v2.0.0-alpha.5 (guia em `como-usar-fechamento.md`)

Regras de classe 2026 conforme `REGRAS_DE_CLASSE.xlsx`. O reajuste de 2027 (+2%) ainda não está aprovado e não foi aplicado. SUS é marcado no cadastro de convênios.

Pedido de 30/10/2026, com exemplo `REPASSE_10-2026_CONTROLE.xlsx`. O fechamento gera uma exportação da competência em três abas, e os indicadores ficam separados.
- **REPASSE USG** (pagamento dia 15):
  - prestadores agrupados por faixa de percentual: geral 44/49/40/40/44/42% por unidade, +2%, residentes 35%, 40%, 49%, 50%, 55% e 70%;
  - colunas por unidade (1, 2, 4, 7, 10, 17) + BOARD, PLANTÃO, TOTAL, DESCONTOS e TOTAL GERAL BRUTO, mais o CNPJ de cada unidade para a NF;
  - o valor por unidade é o Vl Repasse do relatório do MV (ex.: Marcelo Miyazaki, unidade 1 = 4.926,59, igual ao PDF).
- **REPASSE IMG** (último dia útil):
  - colunas: valor da produção de USG, classe, médico e unidades (1, 2, 4, 5, 7, 10, 17), mais PLANTÃO, TOTAL, DESCONTOS e TOTAL GERAL;
  - blocos à parte: médicos V3 que recebem pela SRA (Curitiba), NF complementar (PET-CT, Pluvicto, Curso Cetrus) e observações (pensão, adiantamento parcelado).
- **PRODUÇÃO USG CLASSE:** produção bruta de USG por unidade, com o percentual da unidade, o total e a classe A/B/C/D («fixo classe» para alguns). A produção é o Vl Total dos relatórios de USG: por exemplo, 24.241,46 × 44% = 10.666,25 no repasse.
- **Situação por prestador:** Verificar · E-mail enviado/aguardando nota · Sem valores · Concluído.
- **Controle demais prestadores:** a definir.

## SOL-F8 — Desfazer conflitos de equivalência — IMPLEMENTADA na v2.0.0-alpha.5 (as outras validações voltam a pendente)

No painel de conflitos de «Equivalências TUSS»: escolher o código correto do título e tirar a validação dos demais, com justificativa e histórico.

## SOL-F9 — Power BI como base de dados da competência — IMPLEMENTADA (conciliação) na v2.1.0-alpha

Pedido de 30/10/2026.
- **Regra de competência:** a planilha do Power BI carregada no Início segue a regra de competência. Os dados são do **mês anterior** (produção): competência 10/2026 = dados de 09/2026. Hoje a ferramenta só avisa quando o mês não bate (SOL-F4).
- **Base de dados:** o que for apurado e puder contribuir vai para a base, e não fica só na sessão. Exemplos:
  - catálogo de procedimentos e grupos;
  - códigos de prestador por unidade;
  - faturistas e as unidades em que fecham contas;
  - convênios.
- **Objetivo futuro:** uma camada de automação que case o Power BI com MV, Apolo e NCs (conciliação). Exemplos:
  - conta aberta ou fechada;
  - remessa;
  - quem fechou a conta;
  - lançamento faltante.
- **Cuidado de privacidade a definir na prévia:** CPF nunca é lido. O que guardar por paciente (nome, atendimento) segue a mesma retenção das NCs; o catálogo sem dados de pacientes pode ficar permanente.

## SOL-F10 — Pasta da competência na rede — **IMPLEMENTADA** em partes: pasta raiz (v2.1.0-alpha.9) e estrutura padronizada (SOL-F45, v3.0.0-alpha.14). O arquivamento dos PDFs por médico ficou com a equipe, por decisão do usuário em 17/11/2026

Organização atual do usuário (30/10/2026), uma pasta por competência («REPASSE MM-AAAA»), salva na rede:
- **CORREÇÃO DE PRESTADOR:** relatório da unidade 1 com prestador genérico e os demais relatórios.
- **NAO CONFORMIDADES:** todas as NCs da competência.
- **NFs PAGAMENTO:** NFs recebidas, separadas em dia 15 e dia 30.
- **PLANILHAS-CONFERENCIA:** planilha do Apolo da competência (produção do mês anterior).
- **RELATORIOS-MV-CONFERENCIA:** repasses gerados e PDFs extraídos do MV.
- **REPASSE 20% (Alpha Scann, Dr. Paulo) · REPASSE 25% (Mariana Manfio) · REPASSE EUDES GUERRA (ECO):** controle.
- **REPASSE USG / IMG / PET / SEDAÇÃO / V3 - RELATORIOS PRESTADORES:** uma pasta por médico, com os relatórios daquele pagamento, para enviar ao prestador.
- **Na raiz:** planilhas «REPASSE USG 15-10-2026», «REPASSE IMG 30-10-2026» e ajustes avulsos (ex.: «REAJUSTE REPASSE DR. ROBERTO - PAG. 30-10-2026 (CLASSE B…)»).

Possibilidade técnica: no Chrome e no Edge, o HTML aberto do computador pode ler e gravar numa pasta escolhida pelo usuário (API de acesso a pastas). O navegador pede permissão, e nada sai para a internet.

### O que implementar (proposta de 30/10/2026, pendente de prévia visual)
1. **Salvar direto na pasta da competência.** O usuário aponta uma vez a pasta «REPASSE MM-AAAA» (a permissão é pedida pelo navegador a cada sessão). Cada exportação vai para a subpasta certa, com os nomes usados hoje:
   - NCs → `NAO CONFORMIDADES/NAO CONFORMIDADES MM-AAAA.xlsx`;
   - conferência → `PLANILHAS-CONFERENCIA/`;
   - correção de prestador → `CORREÇÃO DE PRESTEDOR/`;
   - extração do MV → `RELATORIOS-MV-CONFERENCIA/`;
   - fechamento → `REPASSE USG DD-MM-AAAA.xlsx` e `REPASSE IMG DD-MM-AAAA.xlsx` na raiz, em arquivos separados como hoje, além da versão em 3 abas.
2. **Arquivar os PDFs por médico.** Copia cada PDF do MV carregado para `REPASSE USG|IMG|PET|V3 - RELATORIOS PRESTADORES/<Nome do médico>/`, pelo prestador do cabeçalho e pelo tipo do repasse, junto com a prévia do prestador para anexar ao e-mail.
3. **Carregar da pasta.** No Início, «Carregar da pasta da competência» lê o Apolo de `PLANILHAS-CONFERENCIA` e os PDFs de `RELATORIOS-MV-CONFERENCIA` de uma vez.
4. **Pacote .zip** seguindo a mesma árvore de pastas, para quando não houver gravação direta (Firefox ou permissão negada).

Requisitos:
- Chrome ou Edge para gravar em pasta; nos demais navegadores, download normal.
- Nunca apagar arquivos.
- Mostrar antes o que será gravado e onde.
- Registrar no histórico da competência o que foi salvo.

Dúvidas em aberto:
- ordem de prioridade (sugestão: 1 e 2);
- navegador usado no trabalho;
- arquivo com o mesmo nome já existente (substituir ou cópia com data);
- reajustes avulsos (ex.: Dr. Roberto) como ajuste do fechamento;
- PET, Sedação, 20%, 25% e Eco como blocos do fechamento.

---

# Plano a partir da análise do fluxo (30/10/2026)

Origem: `analise-fluxo-e-gargalos.md`. Regra de projeto: **cada dado tem um dono**; quem digita é uma tela, as outras só leem. Cada item segue o método: prévia visual → dúvidas → critérios de aceite → código com teste → guia → GitHub.

| Ordem | Item | Esforço | Situação |
|---|---|---|---|
| 1 | SOL-F11 Aceite na conferência · SOL-F12 «Marcar como enviado» no Fechamento | baixo | planejado |
| 2 | SOL-F13 Classificação do Fluxo lida do Fechamento · SOL-F14 Lista documental do Fluxo lida de Bases | baixo/médio | planejado |
| 3 | SOL-F15 Cobertura de equivalências e validação em lote dos títulos mais frequentes | baixo | planejado |
| 4 | SOL-F16 Status sugerido nas etapas do Fluxo · SOL-F17 Candidatos a NC guardados na competência | médio | planejado |
| 5 | SOL-F10 Pasta da competência · SOL-F18 Base compartilhada para a equipe | médio/alto | planejado |
| 6 | SOL-F19 Quadro Kanban por prestador · SOL-F20 Indicadores de fluxo (lead time, rodadas até o aceite) | médio | **implementado** (F19 na v3.0.0-alpha.15, F20 na v3.0.0-alpha.18) |
| 7 | SOL-F21 Atualizar bases com o Power BI (com SOL-F9) · SOL-F5 Equivalências compostas | alto | planejado |
| 0 | SOL-F22 Arquivos da sessão: limpar e separar conferência × correção · SOL-F23 Excel da conferência reorganizado | baixo/médio | **implementado na v2.0.0-alpha.6** |

## SOL-F11 — Aceite na própria conferência — IMPLEMENTADA na v2.0.0-alpha.16
- **Hoje:** o resultado está na Conferência e o aceite fica em Rodadas (troca de tela a cada relatório).
- **Proposta:** botão «Registrar aceite» no resultado da conferência, com as mesmas regras (observação obrigatória com pendências, já descontadas as decisões). Rodadas continua como histórico.
- **Aceite:**
  - o aceite feito na conferência aparece em Rodadas e no Fechamento;
  - competência fechada bloqueia o aceite.

## SOL-F12 — «Marcar como enviado» no Fechamento — **IMPLEMENTADA** (menu de situação do Fechamento: «E-mail enviado», «NF recebida» e «NF encaminhada» gravam no controle documental do Fluxo, com desfazer e aviso quando o Fluxo não foi iniciado)
- **Hoje:** a prévia é copiada no Fechamento, mas o «relatório enviado» é marcado no controle documental do Fluxo (~40 vaivéns por mês).
- **Proposta:** depois de «Copiar prévia», o botão «Marcar como enviado» grava a data no controle documental do Fluxo. É o mesmo dado, sem cópia; o Fluxo continua sendo o dono.
- **Aceite:**
  - a situação muda para «E-mail enviado» nas duas telas;
  - desfazer é possível;
  - o Fluxo precisa estar iniciado na competência (senão, a tela avisa).

## SOL-F13 — Classificação do Fluxo lida do Fechamento — IMPLEMENTADA na v2.1.0-alpha
- **Hoje:** produção bruta e classe são digitadas no grupo «Classificação» do Fluxo, e o Fechamento já as calcula.
- **Proposta:** o bloco do Fluxo mostra o calculado e só registra a conferência humana («conferido por… em…»). O ajuste manual fica permitido, com justificativa.
- **Aceite:**
  - sem digitação duplicada;
  - divergência entre o ajuste manual e o calculado aparece como aviso.

## SOL-F14 — Lista documental do Fluxo lida de Bases — IMPLEMENTADA na v2.1.0-alpha
- **Hoje:** os prestadores do controle documental vêm de uma lista própria do modelo do Fluxo, separada das regras de Bases.
- **Proposta:** de onde vem cada lista:

  | Fluxo | Lista |
  |---|---|
  | USG | prestadores com faixa de USG |
  | IMG | prestadores que recebem IMG |
  | Curitiba | V3 / unidade 5 |
  | PET, Sedação, 20%, 25% e Eco | lista própria (não têm regra em Bases) |

- **Aceite:** um prestador cadastrado em Bases aparece no Fluxo do mês sem um segundo cadastro.

## SOL-F15 — Cobertura de equivalências e validação em lote — IMPLEMENTADA na v2.0.0-alpha.16
- **Hoje:** sem equivalência validada nada é conferido automaticamente (prestador 15: 67 de 67 pendentes).
- **Proposta:**
  - indicador de **cobertura**: % de linhas conferidas automaticamente por competência, no painel do Início e nos indicadores do Fechamento;
  - lista «títulos que mais destravam» (título × código pendente ordenado pelo nº de linhas afetadas), com validação em lote;
  - sugestão de uso: uma sessão de validação de 1 a 2 horas no início de cada competência.
- **Aceite:** a cobertura sobe de uma competência para a outra e aparece no histórico.

## SOL-F16 — Status sugerido nas etapas do Fluxo — IMPLEMENTADA na v2.1.0-alpha
- **Hoje:** o status das etapas é digitado mesmo quando a ferramenta já sabe o que aconteceu.
- **Proposta:** cada etapa ligada a um dado mostra a sugestão; um clique confirma. Nada conclui sozinho (decisão de 29/10/2026). Exemplos:
  - «12 de 14 prestadores com aceite»;
  - «NCs de USG: 4 abertas»;
  - «planilha de fechamento gerada».
- **Aceite:** a sugestão nunca altera o status sem confirmação; a confirmação fica no histórico da etapa.

## SOL-F17 — Candidatos a NC guardados na competência — IMPLEMENTADA na v2.1.0-alpha
- **Hoje:** os candidatos ficam só na memória e se perdem ao recarregar a página.
- **Proposta:** guardar os candidatos (e os dispensados) na competência, com a mesma retenção de 60 dias das NCs para os dados de pacientes.
- **Aceite:** depois de recarregar, a revisão continua de onde parou.

## SOL-F18 — Base compartilhada para a equipe — **IMPLEMENTADA**: configuração, equivalências e Fluxo já iam pela pasta da rede (SOL-F36, F37 e v3.0); as **NCs** na v3.0.0-alpha.30 (pedido de 24/11/2026; teste: `test/nc_sync.mjs`)

**Como ficou (NCs, v3.0.0-alpha.30):**
- **Arquivo:** um por competência, `AAAA-MM - Mês › 02 - Não conformidades › nao_conformidades.json`, ao lado da planilha de NCs. Leva as NCs e os candidatos dispensados daquela competência. Os candidatos continuam só no navegador.
- **Mescla de três vias,** como nas outras bases:
  - o que mudou de um lado só, vale;
  - a mesma NC alterada pelos dois vira conflito: a pessoa escolhe a versão, e o histórico das duas fica;
  - a exclusão feita por um sai também do outro;
  - a mesma NC registrada pelos dois antes de sincronizar fica uma só, a mais antiga.
- **Quando sincroniza:**
  - toda gravação de NC agenda a sincronização;
  - um relógio confere a cada 30 s se a outra pessoa mudou o arquivo;
  - trocar a competência sincroniza a nova;
  - abrir a aba de NCs também sincroniza.
- **Barra «NCs sincronizadas»** no topo da aba Não conformidades, com quem mudou por último e «Sincronizar agora».
- **Dados de pacientes:** as NCs ficam só na pasta da rede, como a planilha de NCs, e seguem a retenção. Quando a retenção apaga o nome, a mudança também vai para a pasta.

**Proposta original:**
- **Hoje:** cada navegador tem a sua configuração, equivalências, NCs e fluxo. A equipe de dois troca backup à mão, com risco de retrabalho e divergência.
- **Proposta:** na pasta de rede (junto com a SOL-F10), um arquivo por base (configuração, equivalências, NCs, fluxo, competências), com revisão e «quem alterou».
  - Ao abrir, a ferramenta carrega a versão mais nova.
  - Ao salvar, avisa se a outra pessoa alterou o mesmo item desde a última leitura (conflito) e mostra as duas versões.
- **Aceite:** a validação feita por uma pessoa aparece para a outra; nenhuma gravação apaga a alteração da outra sem aviso.

## SOL-F19 — Quadro Kanban por prestador — **IMPLEMENTADA na v3.0.0-alpha.15** (teste: `test/quadro_fechamento.mjs`; guia em `como-usar-fechamento.md`)

**Decisões do usuário (17/11/2026):**
- é uma subaba do Fechamento;
- os cartões mudam de coluna sozinhos, pelos dados;
- «Aguardando terceiros» é uma marca à mão, com motivo;
- não tem limite de WIP.

**Como ficou:**
- **Subaba «Quadro»** com seletor de repasse: Todos, USG, IMG ou Curitiba.
- **As 7 colunas e de onde vêm:**
  - A conferir: sem rodada;
  - Em correção: rodada sem aceite em alguma unidade;
  - Aguardando terceiros: marca à mão;
  - Com aceite;
  - Enviado, NF recebida e Concluído: marcas do controle documental do Fluxo.
- **Clique no cartão:** abre o menu da situação, com «E-mail enviado», «NF recebida», «NF encaminhada», «Aguardando terceiros…» (de quem e motivo) e «Abrir conferência».
- **Excel de indicadores:** ganha a aba «Quadro», com a coluna de cada prestador e quem ele aguarda.

**Proposta original:**
- **Proposta:** visão em quadro no Fechamento (ou no Fluxo), com as colunas:
  1. a conferir;
  2. em correção;
  3. aguardando terceiros;
  4. com aceite;
  5. enviado;
  6. NF recebida;
  7. concluído.
- Também: limite configurável de prestadores «em correção» (WIP), com aviso quando passar.
- **Definição de Pronto por prestador** = situação «Concluído»: aceite, divergências tratadas, prévia enviada, NF encaminhada.

## SOL-F20 — Indicadores de fluxo para a retrospectiva mensal (PDCA) — **IMPLEMENTADA na v3.0.0-alpha.18** (teste: `test/retrospectiva.mjs`; guia em `como-usar-fluxo-mensal.md`)
- **Indicadores:**
  - lead time por prestador (geração no MV → aceite → envio → NF);
  - nº de rodadas até o aceite;
  - tempo de espera por terceiros;
  - cobertura de equivalências;
  - NCs por natureza e faturista (reincidência);
  - dias de antecedência na entrega ao Financeiro.
- **Proposta:** uma aba «Retrospectiva» na competência, com comparação entre meses e um campo de «o que melhorar no próximo mês» (vira item do backlog).

### SOL-F20 — implementação (v3.0.0-alpha.18, 23/11/2026)
- **Onde:** Fluxo mensal → subaba **Retrospectiva**, da competência escolhida no topo. Nada é digitado de novo: tudo sai do Fluxo, das rodadas e aceites, do Fechamento e das NCs. Prazos em **dias úteis**, com os feriados do calendário do Fluxo.
- **Lead time por prestador:** geração no MV → 1ª conferência → aceite → e-mail enviado → NF recebida → NF ao Financeiro, por etapa e no total. A geração é a data em que a etapa «Gerar» do grupo foi concluída no Fluxo; sem ela, vale o marco do modelo (5º dia útil no USG, início do IMG). O aceite conta quando todas as unidades do prestador têm aceite na última rodada. O quadro «Onde o tempo foi gasto» mostra a média de cada etapa e destaca o **gargalo do mês**.
- **Rodadas até o aceite:** por relatório (prestador × unidade), incluindo as rodadas resumidas pela retenção. Mostra a média, o máximo, o % de aceites na 1ª rodada e a distribuição.
- **Espera por terceiros:** tempo das etapas do Fluxo em «Aguardando terceiros» (pelo histórico de status) e das marcas «Aguardando terceiros» do Fechamento (SOL-F19). Ao tirar a marca, ela passa a ficar guardada num histórico (`fechamento.aguardandoHist`); antes ela era apagada. Soma por responsável.
- **Cobertura de equivalências:** a da SOL-F15.
- **NCs:** por natureza e por faturista, contando só as registradas na competência (sem as trazidas de outro mês e sem as «não procede»). **Reincidência** = o mesmo faturista com a mesma natureza em 2 ou mais dos últimos 3 meses.
- **Dias de antecedência na entrega ao Financeiro:** por repasse (USG, IMG, Curitiba e Sedação), em dias úteis, da última NF encaminhada (controle documental) ou da etapa de NF concluída até o pagamento. Compara com a meta do modelo (`antecedenciaDias`, padrão 5).
- **Comparação entre meses:** os indicadores da competência e dos 3 meses anteriores, com ▲▼ verde ou vermelho conforme melhorou ou piorou.
- **PDCA:** «O que melhorar no próximo mês» registra itens no Fluxo da competência (lista `melhorias`), que **sincronizam pela pasta da rede** com o restante do Fluxo. Eles viram o **backlog** da competência seguinte, onde cada item é marcado como Em aberto, Em andamento, Feita ou Descartada (`backlog`, com observação). O que não for feito nem descartado segue sozinho para os meses seguintes (até 12).
- **Excel da retrospectiva** com as abas Resumo (comparação), Lead time, Terceiros, NCs, Antecedência e Melhorias.

## SOL-F21 — Atualizar bases com o Power BI — IMPLEMENTADA na v2.0.0-alpha.11 (faturistas com unidades, convênios com tipo, procedimentos TUSS; o restante da SOL-F9 continua planejado)
- **Hoje:** carregar no Início e depois importar faturistas e convênios em botões separados.
- **Proposta:** ao carregar o Power BI, uma ação única «Atualizar bases» com o resumo do que entra (faturistas e unidades, convênios e tipos, catálogo de procedimentos) e a comparação com a última importação.
- **Aceite:** um passo em vez de três; nada marcado à mão (ex.: SUS) é sobrescrito.

## SOL-F22 — Arquivos da sessão: limpar e separar conferência × correção — IMPLEMENTADA na v2.0.0-alpha.6
- **Hoje:**
  - Na conferência cruzada vale carregar todos os prestadores da mesma unidade. Na mesma sessão, a correção de prestador fica confusa com tantos PDFs no seletor.
  - A correção é sempre feita pelo **prestador genérico Gilberto Miyazaki Otta (código 2)**, lançado antes de se saber quem vai laudar.
  - Ao passar para uma nova competência, os anexos da competência anterior continuam carregados e não batem com a data da competência nova.
- **Proposta:**
  1. «Limpar arquivos» no Início: tudo, só PDFs do MV ou só Apolo/Power BI, com confirmação. O ✕ por PDF continua.
  2. Prestador genérico configurável (padrão: código 2). O PDF dele entra marcado como **Correção** e só aparece no seletor da Correção de prestador; os demais só aparecem na Conferência. Dá para trocar a finalidade de um PDF à mão.
  3. Ao trocar a competência no topo (ou iniciar uma nova), se houver arquivos de outra produção, a ferramenta pergunta «Limpar os arquivos de produção MM/AAAA?». Ao carregar um arquivo de produção diferente da esperada, também avisa antes de incluir.
- **Aceite:**
  - a correção lista só o PDF do genérico;
  - a troca de competência não deixa anexos antigos misturados sem aviso;
  - limpar não apaga rodadas, NCs nem decisões (só a memória da sessão).

## SOL-F23 — Excel da conferência cruzada reorganizado — IMPLEMENTADA na v2.0.0-alpha.6 (opção A: decisão tomada na ferramenta e mostrada no Excel; sem reimportação)
- **Hoje:** a aba principal mistura técnica e conferência (colunas do MV, do laudo, faixa, equivalência), e fica confusa.
- **Aba principal «Conferência»** (uma linha por registro, MV lado a lado com o Apolo):
  - **Situação e decisão:** Status (cor) · Decisão na competência (NC registrada / Considerado no repasse) · Indicar NC · Aceite (com justificativa).
  - **MV (cabeçalho azul):**
    - Unidade MV (a da sessão);
    - Paciente MV;
    - Cód. TUSS MV;
    - Descrição do procedimento MV;
    - Data MV;
    - Convênio MV;
    - Grupo de procedimento MV;
    - Médico MV (prestador do relatório);
    - Vl Repasse.
  - **Apolo (cabeçalho verde):**
    - Unidade Apolo;
    - Paciente Apolo;
    - Título do laudo (TITLE);
    - Descrição do estudo (STUDY);
    - Data Apolo;
    - Convênio Apolo;
    - Modalidade Apolo;
    - Médico Apolo.
  - **No fim:** Ressalvas (marcadores) · Observações e análise (motivos).
- **Abas separadas:**
  - **Pendências:** só o que não está conferido nem tem decisão, com as mesmas colunas.
  - **Resumo:** contagens por status e marcador, valores.
  - **Informações:** arquivos, parâmetros, versões, competência.
  - **Técnico:** faixa do par, equivalência usada, validador, chave da linha, página, conta, atendimento, ID do laudo, linha da planilha, candidatos.
  - **Por procedimento**, **Títulos sem validação** e **MV original**.
- **Colunas de NC e aceite:** a decisão é tomada na ferramenta, que é a dona do dado (um clique por linha, com memória na competência); o Excel mostra a decisão já preenchida. Opcional: reimportar a planilha preenchida (colunas «Indicar NC» e «Aceite») para registrar as decisões em lote. A decidir com o usuário.

## SOL-F24 — Excel da correção de prestador objetivo para corrigir no MV — IMPLEMENTADA na v2.0.0-alpha.7
Pedido de 30/10/2026: «muito confuso, tenho que ficar ocultando colunas, o motivo fica no começo».
- **Aba «Corrigir no MV»** (primeira): só as linhas com médico do laudo diferente do prestador do relatório, agrupadas por médico. Colunas:
  - Status;
  - Atendimento MV, Conta MV, Cód. TUSS MV, Descrição do procedimento MV, Paciente MV, Data MV, Convênio MV, Vl Repasse;
  - Médico do laudo (Apolo), Cód. prestador, Paciente Apolo, Data Apolo, TITLE, STUDY;
  - Observações (motivo e detalhe) e Alertas, no fim.
- **Mesmas colunas em:** Todas as linhas, Não identificados, Conflitos e insuficientes.
- **Abas à parte:**
  - Resumo;
  - Informações;
  - Equivalências a analisar;
  - Técnico (linha, chave, página, remessa, %, Vl Total, grupo, ID do laudo, laudos do paciente na data).
- Não identificado continua sem médico (RN-206).

## SOL-F25 — Menu no celular: gaveta lateral e barra com 6 atalhos — IMPLEMENTADA na v2.0.0-alpha.8
Pedido e prévia aprovada em 01/11/2026.
- **Topo:** ☰ ao lado (à esquerda) do logo. Toque ou deslize da borda esquerda abre a gaveta com as 10 abas, em dois grupos (Trabalho do mês; Bases e ajustes), com os contadores.
- **Fechar a gaveta:** ✕, toque fora, deslizar para a esquerda, Esc ou escolher uma aba.
- **Barra de baixo:** Início · Fluxo · Conferir · Prestador · NCs · Fechar, com ponto laranja de pendência. O ☰ ganha ponto laranja quando uma aba fora da barra tem pendência.
- **No computador:** nada muda. Só a ordem do menu: Rodadas passou para o grupo de trabalho do mês, antes de Equivalências.

---

# Objetivos de mudança para 03/11/2026 (aguardando os demais ajustes antes de executar)

## SOL-F26 — Início: tirar o anexo de equivalências e pôr os arquivos em três cards lado a lado — IMPLEMENTADA na v2.0.0-alpha.9
- **Retirar do Início** o card «Equivalências TUSS» (importar planilha de análise/base). A importação fica só dentro da aba Equivalências TUSS, que já tem esses botões.
- **Três cards lado a lado**, na mesma linha:
  1. Relatório de repasse MV (PDF);
  2. Laudos do Apolo (.xlsx);
  3. Power BI (.xlsx) — opcional.

  No celular, um embaixo do outro.
- **O resto da página não muda:** passos «Preparar o repasse», lista de relatórios do MV, atalhos para Conferência e Correção, painel da competência.
- **A decidir na execução:** o passo 3 da lista «Preparar o repasse» (equivalências validadas) continua como indicador, com link para a aba Equivalências.

## SOL-F27 — Fechamento: tabela «quebrando» ao rolar (nomes por cima do cabeçalho) — IMPLEMENTADA na v2.0.0-alpha.9 (com os percentuais da faixa embaixo de cada unidade)
- **Sintoma** (print de 03/11, aba Repasse IMG): ao rolar a tabela para baixo, os nomes das primeiras linhas (Amanda, Gustavo) aparecem **por cima do cabeçalho**, cobrindo «Prestador».
- **Causa:** a tabela tem duas fixações:
  - o cabeçalho fica parado ao rolar para baixo (`th` com `position:sticky; top:0; z-index:1`);
  - a coluna do prestador fica parada ao rolar para o lado (`.fh-nome` com `position:sticky; left:0; z-index:1`).

  Com o mesmo nível de camada, a célula do nome, que vem depois no HTML, é desenhada por cima do cabeçalho.
- **Ajuste:**
  - cabeçalho da tabela do Fechamento acima das células (`z-index:2`);
  - cabeçalho da coluna do prestador acima de tudo (`z-index:3`), para ficar parado nos dois sentidos;
  - a linha da faixa (USG), que também fica parada à esquerda, com fundo próprio.
- **Revisar junto:** as tabelas de USG, IMG, V3 e Produção, no computador e no celular, com rolagem para baixo e para o lado.

## SOL-F28 — NF complementar editável (um cartão de cadastro no lugar dos blocos fixos) — IMPLEMENTADA na v2.0.0-alpha.11
- **Hoje:** o Fechamento → Repasse IMG tem dois blocos fixos, «PET-CT e Pluvicto» e «Curso Cetrus (R$ 1.000 por período)». Eles nem sempre existem (Cetrus e Pluvicto são sazonais) e não aceitam outros tipos.
- **Proposta:** um único cartão **«NFs complementares da competência»**, com «+ NF complementar» abrindo um formulário com:
  - **Prestador:** escolhido do cadastro (Bases), preenchendo código e nome sozinho. Dá para digitar um prestador fora do cadastro.
  - **Do que se trata:** texto livre com sugestões dos tipos já usados (Laudos PET-CT, Aplicação Pluvicto, Curso Cetrus, Reajuste de classe…). A lista de sugestões cresce com o uso.
  - **Valor:** total, ou quantidade × valor unitário (ex.: 4 períodos × R$ 1.000).
  - **Competência da NF:** o mês de referência do serviço, que pode ser diferente da competência do repasse (ex.: complemento retroativo). Padrão: a competência do topo.
  - **Unidade / CNPJ de emissão:** padrão unidade 17 (Palhano), como nas NFs de PET-CT e Cetrus de hoje.
  - **Observação.**
- **Lista do cartão:** cada NF com editar e excluir; total por prestador e geral. Some quando não houver NF no mês.
- **Exportação:**
  - na planilha do IMG, bloco «NF COMPLEMENTAR», agrupado pelo tipo e com o CNPJ de emissão;
  - na «Copiar prévia» do prestador;
  - no pacote da competência;
  - nos indicadores (total de NFs complementares).
- **Migração:** o que já foi lançado nos blocos atuais (PET-CT/Pluvicto e Cetrus) vira NF complementar sem perder dados.
- **Liga com:** o «Reajuste repasse Dr. Roberto (classe B)» da pasta de rede (SOL-F10, dúvida 4) entra aqui como NF complementar do tipo «Reajuste».

## SOL-F29 — Base de dados de referência e campos que buscam no cadastro (sem redigitar) — IMPLEMENTADA na v2.0.0-alpha.11 (partes 1 e 2, com a SOL-F21)
Pedido de 03/11/2026: «onde exige prestador, deve recuperar da base cadastrada; não faz sentido cadastrar e depois ficar digitando». Vale para as coisas comuns: **prestadores, convênios, faturistas, TUSS e unidades**.

### 1. Base de dados de referência (uma só, usada pelo sistema inteiro)
Junta e guarda, de forma permanente e sem dados de pacientes, o que hoje está espalhado ou só na sessão:

| Catálogo | Fontes | Campos |
|---|---|---|
| Prestadores | cabeçalho dos PDFs do MV, planilha de controle, Power BI (CD_PRESTADOR), Bases | código, nome no MV, aliases/nome no Apolo, unidades onde atua, regras |
| Convênios | Power BI (nome + tipo), relatórios do MV, cadastro manual | nome, tipo (SUS/Convênio/Particular), unidades |
| Faturistas | Power BI («Nome do Usuario que Fechou a Conta»), planilha de NCs, cadastro manual | nome, unidades |
| TUSS / procedimentos | Power BI (código, descrição, grupo), MV, equivalências | código, descrição, grupo, títulos do Apolo ligados |
| Unidades | cadastro padrão, Power BI, Apolo (BRANCH_NAME) | código, nome, nomes no Apolo e no Power BI, CNPJ, % USG |
| Médicos do Apolo | planilha do Apolo (NAME_MEDICO) | nome, ligação com o código de prestador |

- **Atualização:** o **Power BI é a principal fonte** (SOL-F9 e SOL-F21). Ao carregar, «Atualizar base de dados» mostra o que é novo e o que mudou; nada marcado à mão é sobrescrito.
- **Limite:** o Power BI traz o código do prestador, mas não o nome do médico. O nome vem do cabeçalho do MV, da planilha de controle ou do vínculo com o Apolo.
- **Origem:** cada item guarda de onde veio e quando, e a alteração entra no registro da competência (SOL-F4).

### 2. Campo de busca igual em todo o sistema
- **Como funciona:** um componente único («digite 2 letras ou o código → lista do cadastro»). Escolher o item preenche os campos ligados (ex.: prestador → código + nome; convênio → nome + tipo; TUSS → código + descrição).
- **Fora do cadastro:** quando for permitido, a opção «usar o texto digitado» fica disponível e pergunta se quer cadastrar.
- **Onde aplicar** (campos hoje digitados):
  - **Não conformidades** (nova/editar): médico, convênio, prestador incorreto e corrigido, unidade e responsável (hoje só sugestão simples).
  - **Fechamento:** NF complementar (SOL-F28) e qualquer prestador avulso.
  - **Fluxo mensal:** «+ Prestador» do mês e do modelo.
  - **Bases:** prestador manual (buscar o código no Power BI), alias (médicos do Apolo, já é lista), faturista e convênio (sugerir os vistos no Power BI e ainda não cadastrados).
  - **Equivalências:** nova relação, com código TUSS (catálogo) e TITLE (títulos do Apolo carregado).
  - **Regras do prestador e faixas.**
- **Aceite:**
  - nenhum campo de prestador, convênio, faturista, TUSS ou unidade exige digitar o que já está no cadastro;
  - o item escolhido sempre leva o código junto (sem divergência de grafia);
  - funciona no celular.

### Ordem sugerida
1. Componente de busca e catálogos atuais: prestadores, convênios, faturistas, unidades, TUSS das equivalências.
2. Aplicar nas telas acima.
3. Atualização pelo Power BI (junto com SOL-F21 e SOL-F9).

## SOL-F30 — Fechamento: controle do repasse de Curitiba (V3) — IMPLEMENTADA na v2.0.0-alpha.12 (ver «Implementação» abaixo)
Pedido de 03/11/2026: «quero um controle também para os prestadores da V3 Curitiba; hoje não controlo como os demais, fica só no e-mail».
- **O que já existe:**
  - **Fluxo mensal:** grupo «Repasse de Curitiba» (fluxo próprio, sem separação USG/IMG, até o 20º dia útil, pagamento no último dia útil), com controle documental.
  - **Fechamento → IMG:** bloco «Médicos V3 que recebem pela SRA (laudos)», com os médicos da V3 que laudam para outras unidades.
  - **Bases:** unidade 5 = AlphaSonic Curitiba, CNPJ 10.563.835/0001-03; regra V3 no prestador.
  - **Pasta de rede:** «REPASSE V3 - RELATORIOS PRESTADORES».
- **Proposta:** nova sub-aba **«Repasse Curitiba (V3)»** no Fechamento, igual às de USG e IMG:
  - pagamento e prazo de envio do Fluxo (pagCuritiba / envioCuritiba);
  - prestadores com regra «Curitiba/V3» em Bases, mais quem tiver relatório da unidade 5 na competência;
  - valores das rodadas com aceite da unidade 5 (USG e IMG juntos, como no fluxo de Curitiba);
  - situação por cor (Verificar · Sem valores · Conferido · E-mail enviado · Concluído), lida do controle documental do grupo Curitiba do Fluxo;
  - plantão, descontos e observações do mês; «Copiar prévia» com o CNPJ da V3;
  - aba própria na exportação e nos indicadores.
- **Dúvidas para o usuário:**
  1. Curitiba gera no MV relatórios de repasse por prestador, como as outras unidades?
  2. As regras de valor são as mesmas (% de USG, classe do IMG) ou a V3 tem regras próprias por prestador?
  3. Exportação: aba na planilha de controle geral, ou arquivo separado (há a pasta «REPASSE V3»)?
  4. O bloco «Médicos V3 que recebem pela SRA» continua no IMG ou passa para a nova sub-aba?

---

# Respostas de 03/11/2026 (para a execução dos objetivos de hoje)

## SOL-F27 (complemento) — percentuais no cabeçalho do Fechamento
- O percentual de cada unidade fica **embaixo do nome da unidade, no cabeçalho** da tabela de USG, para ficar visualmente organizado.
- Hoje ele aparece na linha da faixa. Ali continua só o nome da faixa; quando a faixa tiver percentual diferente, o valor aparece por faixa.

## SOL-F28 (definido) — NF complementar
- **Unidade/CNPJ de emissão:** obrigatório e editável ao incluir uma NF nova. Cada categoria tem um CNPJ padrão, que pode ser trocado.
- **Layout como no exemplo:** Cód. · Prestador · Descrição 1 · Descrição 2 (cada descrição/categoria em sua coluna, com o valor) · Total.
- **Em todos os fechamentos:** USG, IMG e Curitiba. Não aparece em Produção.
- **Competência:** sempre a do mês atual (a do topo), mesmo que se refira ao mês anterior.
- **Tipos iniciais:** Laudos PET-CT, Aplicação Pluvicto, Curso Cetrus e Reajuste. São sugeridos **só no fechamento do IMG** (pagos no último dia útil). Nos outros fechamentos, a categoria é livre.

## SOL-F31 (nova) — Descontos parcelados com alerta — IMPLEMENTADA na v2.0.0-alpha.12
- **Cadastro de desconto por prestador:** motivo (ex.: pensão alimentícia, adiantamento), valor da parcela, número de parcelas, parcela inicial e competência de início.
- **No Fechamento:** a parcela do mês entra sozinha em DESCONTOS, com a observação «parcela 7/10».
- **Alertas:**
  - prestador com desconto ativo;
  - última parcela;
  - desconto sem valor no mês;
  - desconto maior que o repasse.
- **Histórico** das parcelas pagas por competência.

## SOL-F30 (definido) — Curitiba = V3
- **Termo:** sempre que se falar em V3, é Curitiba (unidade 5).
- **Relatórios:** Curitiba gera relatório de repasse por prestador no MV, como as demais unidades.
- **Regras:** **diferenciadas por prestador**, sem padrão para todos. Alguns fazem certos exames e outros não, e o valor muda por médico.
  - Em Bases → Prestadores, um **espaço só para os prestadores de Curitiba**, com as regras de cada um.
  - **Exemplo — Dr. Ian e Dr. Augusto Venício:**
    - Ultrassonografia, regra por volume de exames no mês:

      | Exames de USG no mês | Repasse |
      |---|---|
      | até 799 | 65% do faturamento líquido |
      | 800 a 999 | 68% do faturamento líquido |
      | 1000 ou mais | 70% do faturamento líquido |

    - Densitometria: 10% do valor bruto.
  - **HM (só Curitiba paga HM):**
    - só HM de **USG e Doppler**; HM de raio-X, mamografia e demais não é paga;
    - só HM do convênio **Unimed**;
    - vale para todos os prestadores que fazem USG, com o valor da regra do prestador pago.
  - Se necessário, essas regras entram no motor de conferência como «regra da V3».
- **Exportação:** uma aba a mais na planilha de controle geral. Isso vale para qualquer controle novo que entrar.
- **Bloco «Médicos V3 que recebem pela SRA»:** sai do IMG e vai para a aba de Curitiba.

## SOL-F30 (respostas de 03/11/2026) — Regras da V3 (Curitiba)
- **Cálculo fora do MV.** Na V3 o repasse é calculado fora do MV, hoje no e-mail. Exemplo do Dr. Ian (competência 10/2026):

  > Foram realizados 1539 exames de ultrassom. Densitometria: R$ 0,00 (sem produção). Honorários USG UNIMED: R$ 21.907,88. USG: R$ 93.838,16.
  > Ultrassom R$ 93.838,16 + HM R$ 21.907,88 = R$ 115.746,04 − impostos (9,15%) = R$ 105.155,28 × 70% = **R$ 73.608,69** (total para emissão da NF).

  Portanto, o Fechamento da V3 **calcula** o valor da NF pela regra do prestador. A conta fica visível, e o e-mail pode ser gerado com «Copiar prévia».
- **Volume de exames:** soma da **quantidade** dos procedimentos de USG do prestador na V3 no mês, e não o nº de linhas.
- **Regras por prestador:** cadastro em **Bases → Prestadores → Médicos V3**, uma regra por médico, porque não há padrão. Cada regra tem:
  - exames que o médico faz;
  - forma de cálculo: % do líquido por faixa de volume, % do bruto ou valor por laudo;
  - base de cálculo e % de impostos (padrão 9,15%);
  - faixas, quando houver;
  - como paga o HM.
  - **Dr. Ian e Dr. Augusto Venício:** USG + HM com faixas por volume (até 799: 65% · 800 a 999: 68% · 1000 ou mais: 70%) sobre o líquido, já descontados os impostos; densitometria a 10% do valor bruto.
  - **Demais prestadores** (ex.: Dr. Alexandre Romanus): o valor do HM é o mesmo do laudo de USG. As regras de cada um são cadastradas pelo usuário na tela.
- **HM na V3 (regra da unidade):**
  - só se paga HM de **USG e Doppler** do convênio **Unimed** (nome contém «UNIMED», ex.: «UNIMED CURITIBA»);
  - todo procedimento de USG/Doppler Unimed executado na V3 gera HM a pagar, **mesmo sem laudo correspondente**;
  - HM de outro grupo (raio-X, mamografia…) ou de outro convênio **não é pago** e é **sinalizado para exclusão**. Não é necessariamente uma NC;
  - essa regra entra no motor de conferência como «regra da V3» para a unidade 5. Hoje o HM fica como «HM — regra pendente».
- **Classe A/B/C/D:** não se aplica aos médicos da V3. A produção que médicos do SRA fazem na V3 fica separada da classificação do SRA.
- **Aba da V3:** só médicos da V3, sem misturar com os do SRA. Inclui o bloco «Médicos V3 que recebem pela SRA».

## Decisões confirmadas
- **F26:** o passo «Equivalências TUSS validadas» fica no Início como indicador, com link para a aba.
- **F29:** prestador fora do cadastro → a ferramenta pergunta se quer cadastrar. Do Power BI ficam só os catálogos, sem dados de pacientes.
- **F28:** uma coluna por categoria (como «LAUDOS PET-CT» | «APLICAÇÃO PLUVICTO» | TOTAL), para testar.

## Nota de comunicação
O usuário prefere poucas perguntas por vez, sem listas numeradas longas. Ao responder, o campo de texto dele continua a numeração sozinho.

## SOL-F32 — Situação do prestador no Fechamento com ação manual — IMPLEMENTADA na v2.0.0-alpha.11 (inclui a SOL-F12)
Pergunta de 03/11/2026: «no fechamento, em status não consigo selecionar nada; se precisar colocar como verificar, faço como?»
- **Hoje:** a situação é só calculada (sem aceite = Verificar; sem relatório = Sem valores; com aceite = Conferido; relatório enviado no Fluxo = E-mail enviado; NF ao Financeiro = Concluído). Não há como marcar à mão.
- **Proposta:** o selo da situação vira um menu com ações:
  - «Marcar para verificar…»: com motivo obrigatório, vale por cima do calculado e aparece com ✎ e o motivo; «Tirar a marca» volta ao calculado;
  - «Marcar e-mail enviado» (SOL-F12): grava a data no controle documental do Fluxo, que é o dono do dado;
  - «NF recebida» e «NF encaminhada ao Financeiro»: também gravam no controle documental do Fluxo.
- A marca manual fica na competência, com quem fez e quando, e conta nos indicadores e na exportação (cor «Verificar»).

## SOL-F33 — Exportação do Fechamento no layout do modelo do usuário — IMPLEMENTADA na v2.0.0-alpha.10
Modelo: `exemplo_saida_repasse_usg_img_v3_e_produção.xlsx` (03/11/2026).
- **Abas:**
  - REPASSE USG dd-mm-aaaa;
  - REPASSE IMG dd-mm-aaaa;
  - **REPASSE CURITIBA dd-mm-aaaa** (nova);
  - PRODUÇÃO USG CLASSE mm-aaaa.
- **REPASSE USG:** um bloco por faixa (médicos geral, com acréscimo de 2%, residentes, 40%, 49%, 50%, 55%, 70%).
  - Cada bloco tem o título mesclado, o cabeçalho EMPRESAS · unidades · BOARD · PLANTÃO · TOTAL · DESCONTOS · TOTAL GERAL BRUTO (os três últimos mesclados em três linhas), a linha CNPJ (BOARD e PLANTÃO mesclados) e a linha PORCENTAGEM com o percentual da faixa em cada unidade.
- **REPASSE IMG:**
  - colunas: produção de USG, classe, médico e unidades 1, 2, 4, 5, 7, 10 e 17;
  - cabeçalho mesclado, como no modelo;
  - blocos de NF complementar (Curso Cetrus; PET-CT e Pluvicto) no layout do modelo;
  - os médicos V3 saem desta aba.
- **REPASSE CURITIBA:** os médicos V3, com o cálculo pela regra de cada um e a memória de cálculo (SOL-F30, alpha.12).
- **PRODUÇÃO USG CLASSE:** cabeçalho CLASSE · MÉDICOS · UNIDADE n · TOTAL · Observação, com a linha de percentuais.
- **Formatação:**
  - Arial 10, bordas finas, cabeçalho azul 1F4E78 com texto branco;
  - CNPJ em azul-claro (DCEAF7), percentuais em azul (A6CAEC);
  - valores em formato contábil R$, totais com fórmula;
  - zoom 85%, larguras do modelo.
- **Cores e legenda:** a cor da situação fica no código e no nome; «Sem valores» fica sem cor, como no modelo. A legenda vai no fim de cada aba.
- **Ainda não incluído:** a coluna de avisos não vai mais para a planilha; os avisos ficam na tela.


## SOL-F30 e SOL-F31 — implementação (v2.0.0-alpha.12, 03/11/2026)
Prévia aprovada em 03/11/2026. Resposta do usuário: «doppler conta no volume» e «sempre entenda o doppler como parte do grupo de USG».

### SOL-F30 — V3 (Curitiba)
- **Bases → Prestadores e regras → Médicos V3:** lista só dos médicos V3, com a regra de cada um, e «+ Médico V3» (busca no cadastro).
  - **Regras…** por médico: impostos (padrão 9,15%); USG com Doppler (% do líquido por faixa de volume, % do líquido, % do bruto, valor por laudo ou não paga); até 5 faixas; HM de USG/Doppler Unimed (entra no faturamento da USG, igual a um laudo de USG ou não paga); até 4 «outros exames» (texto de busca no grupo/descrição do MV, ex.: DENSITOM) pagos por % do bruto, % do líquido ou valor por laudo.
  - Regra nova começa com a do Dr. Ian (65/68/70% do líquido; densitometria 10% do bruto). Dá para «copiar a regra de» outro médico V3.
- **Cálculo** (motor `47-v3.js`): volume = soma da quantidade dos procedimentos de USG e Doppler; base = USG bruto + HM Unimed (quando entra no faturamento); líquido = base − impostos; % pela faixa; outros exames somados. Arredonda só no final. O exemplo do Dr. Ian dá R$ 73.608,69.
- **Fechamento → Repasse Curitiba (V3):** só médicos V3; colunas de exames, USG bruto, HM Unimed, outros, líquido, % e o total da NF na unidade 5. Outras unidades (laudos para o SRA) seguem o relatório do MV. Sem regra: valor do MV com aviso. Classe A/B/C/D não se aplica.
  - **Memória de cálculo** com o texto do e-mail no formato de hoje, a origem de cada número, os HM a excluir e o que ficou fora do cálculo. «Copiar e-mail» copia o texto.
  - Médicos V3 saíram do Repasse IMG e da Produção/classe.
- **Conferência da unidade 5:** HM de USG/Doppler do convênio Unimed vira «Conferido» com o marcador **HM V3 devido** (pago mesmo sem laudo). Outro HM fica «HM — regra pendente» com o marcador **HM V3 a excluir** (não vira NC sozinho).
- **Exportação:** aba REPASSE CURITIBA com o cálculo por médico, NF complementar, observações e a memória de cálculo de cada um.
- **Doppler = USG** também no mapa de modalidade (laudo de US) e na separação USG/IMG das rodadas.

### SOL-F31 — Descontos parcelados
- **Bases → Prestadores e regras → Descontos parcelados:** prestador (busca), motivo, valor da parcela, nº de parcelas (vazio = recorrente), competência da 1ª parcela e em qual fechamento entra (USG, IMG ou Curitiba). Lista com «7 de 10», situação (ativo, recorrente, última parcela, quitado, adiado, encerrado) e histórico por competência. Editar, encerrar (mantém o histórico) ou excluir.
- **Fechamento:** a parcela do mês entra sozinha em DESCONTOS, com a observação «Adiantamento · parcela 7/10» e o selo «auto». Valor digitado à mão vale por cima (selo «manual») e fica registrado nas alterações da competência; apagar o valor volta ao automático.
- **Alertas** no cartão «Descontos parcelados do mês»: última parcela; prestador sem valores (a parcela não é descontada; botão «Levar para o próximo mês», que empurra as seguintes um mês, com «desfazer»); desconto maior que o repasse.
- **Exportação:** a observação sai nas OBSERVAÇÕES («DESCONTO … R$ … ADIANTAMENTO · PARCELA 7/10»).
- **Pendente de confirmação** (assumido como na prévia): densitometria somada depois do percentual, fora do imposto; «USG bruto» com todos os convênios; parcela sem valores só passa para o mês seguinte quando o usuário clica em «Levar para o próximo mês».

## Ajustes de 03/11/2026 (pedido com prints)
- **Avisos recolhíveis no Fechamento** (USG, IMG e Curitiba): botão «⚠ N avisos»; clicar no botão ou na linha abre a lista embaixo, como o detalhe da Conferência, e clicar de novo recolhe.
- **«Exportar competência»** sem «(3 abas)».
- **NF complementar na exportação: um bloco por categoria** (e por unidade/CNPJ), com QUANTIDADE e VALOR UNITÁRIO quando houver e total com fórmula. Substitui o bloco com uma coluna por categoria da F28.
- **Atalho «+ Cadastrar» nos médicos do Apolo sem vínculo** (Bases → Prestadores e regras): cadastra um novo prestador com o código do MV (médico ou residente) ou liga o nome a um prestador já cadastrado como alias validado (RN-208). Nomes parecidos no cadastro aparecem só como dica para conferir; nada é ligado sozinho.
- **Regras do prestador:** «Recebe repasse de IMG» e «Médico V3 (Curitiba)» viraram cartões com explicação, em vez de caixas soltas.

## V3 — dois modos de regra e lista só da V3 (03/11/2026, v2.0.0-alpha.14)
- Pedido: «na V3 só o Dr. Ian recebe seguindo essas regras; para outros prestadores são valores fixos». A regra de cada médico V3 agora tem dois modos:
  - **Valor fixo por laudo** (padrão para regra nova): um valor por **grupo de procedimento do MV**, escolhido numa lista (grupos dos relatórios do MV, das rodadas e do Power BI) mais o grupo especial «USG (inclui Doppler)». Cada grupo tem «R$ por laudo» e «R$ por HM Unimed». Ex.: Dr. Alexandre Romanus — USG R$ 33,00 o laudo e R$ 33,00 o HM Unimed; ressonância R$ 45,00. Só o HM de USG/Doppler Unimed é pago, pelo valor de HM do grupo de USG.
  - **Percentual do faturamento (como o Dr. Ian):** a regra que já existia. Os «outros grupos» também passaram a ser escolhidos na lista de grupos do MV.
- **Lista de prestadores:** médico marcado como V3 que **só** atua na V3 (sem faixa de USG, IMG ou BOARD do SRA) sai da lista geral e fica só em «Médicos V3». Quem atua também nas outras unidades continua na lista geral e aparece em «Médicos V3» com «V3 e outras unidades». O cartão V3 ganhou aliases do Apolo e «+ Alias».
- **Atalho do Apolo:** o tipo «Médico V3 (Curitiba)» cadastra o médico já na V3 e abre a regra.

## Conferência: médico do laudo pelo cadastro e nome do Excel (03/11/2026, v2.0.0-alpha.15)
- **Médico do laudo:** ao escolher o relatório e a unidade, a ferramenta já seleciona o médico do Apolo ligado ao prestador no cadastro (nome igual ao do cabeçalho do MV ou alias validado) e mostra o nome dele na lista, com «(do cadastro)» e de onde veio o vínculo. A escolha manual só é lembrada para o mesmo relatório e a mesma unidade. Sem vínculo e com nome parecido no Apolo, aparece «Vincular … como alias» (alias validado com o operador, RN-208).
- **Nome do Excel** da conferência e da correção: `conferencia_medico_3_unidade_17_comp_10-2026_rodada_<id>.xlsx`. O antigo usava a data do repasse com «/», que cortava o nome. A chave da rodada é a mesma do resultado, da aba «Informações» e da nova coluna «Rodada» em Rodadas (onde fica o aceite).

## SOL-F34 — Troca do Apolo pelo Cloov (laudos) — A FAZER quando houver o primeiro arquivo do Cloov
Aviso de 03/11/2026: em alguns dias a plataforma de laudos muda do Apolo para o **Cloov**. Ainda não se sabe como será a extração dos dados.
- **Hoje:** a ferramenta lê a planilha do Apolo pelos nomes das colunas (`30-fontes.js`, `lerApolo`), com duas grafias aceitas para cada campo.
- **Campos que a conferência precisa** (o resto é opcional):

  | Campo | Apolo hoje | Para quê |
  |---|---|---|
  | Unidade | BRANCH_NAME | filtrar os laudos da unidade |
  | Paciente | PATIENT_NAME | casar com a linha do MV |
  | Data do exame | STUDY_DATETIME | casar pela data (tolerância) |
  | Título do procedimento | TITLE | equivalência TUSS × título |
  | Médico que laudou | NAME_MEDICO | médico do laudo / aliases |
  | Modalidade | MODALITY | US, CT, MR, CR/DX, MG, OT |
  | Opcionais | PATIENT_ID, PATIENT_INSURANCE, ID, ACCESSION_NUMBER, STATUS | duplicidade de cadastro, convênio, chave do laudo |
- **Plano:**
  1. Com o primeiro arquivo do Cloov, mapear as colunas para os campos acima. Se possível, ler o formato automaticamente, como o Apolo.
  2. Se os nomes forem diferentes, criar **«De-para de colunas» configurável** em Bases (escolher qual coluna do arquivo é cada campo, uma vez só, guardado na configuração), aceitando Apolo e Cloov.
  3. **Nomes:** unidades (BRANCH_NAME → «Nome(s) no Apolo» das unidades), médicos (aliases) e títulos (equivalências TUSS × título) podem vir escritos de outro jeito no Cloov. Prever revisão de unidades e aliases, e reaproveitar as equivalências validadas quando o título for igual.
  4. **Modalidade:** se o Cloov não trouxer MODALITY, deduzir pelo título ou pelo grupo, com aviso.
  5. Manter o Apolo funcionando para competências antigas e para a transição (mês com parte no Apolo e parte no Cloov: carregar os dois arquivos).
- **Para o usuário pedir ao Cloov:** exportação em Excel/CSV com, no mínimo, os campos da tabela, um laudo por linha e o período escolhido.

## SOL-F11 e SOL-F15 — implementação (v2.0.0-alpha.16, 03/11/2026)
Prévia aprovada: «pode desfazer aceite e rodar sozinha».
- **F11 – Aceite na Conferência:** quadro «Aceite desta rodada» no resultado, com linhas pendentes já descontadas as decisões e observação obrigatória quando há pendências. Botões «Registrar aceite» e «Registrar aceite e ir para o próximo relatório» (seleciona o próximo PDF da conferência, na mesma unidade, sem rodar sozinho). Depois do aceite: quem, quando, observação e «Desfazer aceite» (com a competência aberta). O aceite desfeito fica no histórico da rodada (Rodadas → detalhe). Em Rodadas, o botão ↺ também desfaz. Competência fechada bloqueia.
- **F15 – Cobertura:** cobertura = linhas de procedimento «Conferido» ÷ linhas de procedimento, na última rodada de conferência de cada relatório da competência.
  - **Início:** cobertura da competência, variação contra o mês anterior, mini-histórico de 4 meses e o atalho «o que mais destrava».
  - **Equivalências → «O que mais destrava»:** pares título × código que travam (pendente, sem cadastro, em conflito), ordenados pelas linhas que viram «Conferido» com a validação. Inclui «ver pares» com exemplos (prestador, unidade, data, conta/atendimento), filtro por unidade e simulação do ganho de cobertura. «Validar selecionados» valida com responsável e justificativa (cria a relação quando não existe) e roda de novo, sozinha, as conferências afetadas que estão carregadas na sessão. «Não correspondem» desativa a relação pendente e tira o par da lista; a linha continua pendente na conferência. Par em conflito fica fora do lote.
  - **Fechamento → Indicadores:** cobertura por prestador, com o maior bloqueio (título × código), e o mesmo bloco no Excel de indicadores.
  - As rodadas passam a guardar, por linha, o título do laudo pareado, a situação da equivalência e a data (sem paciente). Rodadas antigas não entram na lista.

## v2.1.0-alpha — F17, F14, F13, F16, F5 e F9 (03/11/2026)
Pedido: «da F17 até a F16, F5, F9, pode executar na ordem que for melhor; depois lance uma versão v2.1.0-alpha».
- **F17 – Candidatos a NC guardados:** ficam na base de NCs, por competência, com a mesma retenção de 60 dias (a análise inteira sai ao vencer). A análise rodada de novo substitui os candidatos dela. Dispensados também ficam guardados (com quem e quando). Depois de recarregar a página, a revisão continua pela aba Não conformidades.
- **F14 – Lista documental de Bases:** USG = prestadores com faixa de USG (fora V3); IMG = recebem IMG (fora V3); Curitiba = médicos V3. Quem é cadastrado em Bases entra sozinho no mês aberto (marcado «· Bases»). Remover do mês vale só para o mês e não volta sozinho. PET, Sedação etc. continuam com lista própria.
- **F13 – Classificação do Fluxo:** produção bruta de USG e classe vêm do Fechamento. O Fluxo registra a conferência humana («Conferir» / «Conferir todos os que não têm ajuste», com quem e quando). Se o valor muda depois, aparece «valor mudou depois da conferência». Ajuste manual exige justificativa e aparece como aviso quando difere do calculado (o Fechamento continua usando a regra de Bases).
- **F16 – Status sugerido:** cada etapa ligada a um dado mostra «💡 Sugestão: Concluída — 12 de 12 com aceite» e o botão «Confirmar». Nada muda sem o clique; a confirmação fica no histórico da etapa. Fontes: aceites do Fechamento (USG, IMG, Curitiba), envio e NF do controle documental, classificação conferida, rodadas de correção e NCs enviadas ao Qualiex. A sugestão só aparece quando avança o status atual.
- **F5 – Regras compostas e por convênio** (Equivalências → «Regras compostas e por convênio»): título do laudo → vários códigos (ex.: articular + doppler), com variação por convênio (ex.: UNIMED = só doppler) e escopo por unidade. Só regra validada, com responsável, vale; editar uma validada volta a pendente. Na conferência: um laudo sustenta uma linha por código esperado (marcador «Regra composta»); código esperado que não está no MV → «Composição incompleta» (ressalva, diz qual falta); código lançado que não faz parte para aquele convênio → «Procedimento diverge», com o motivo. A mescla de base JSON leva as regras compostas.
- **F9 – Conciliação com o Power BI:** com o Power BI carregado, cada «Só no laudo» da conferência é procurado no faturamento (mesmo paciente, data na tolerância, unidade, procedimento compatível) e classificado: sem lançamento · lançado para outro prestador · lançado para o médico do laudo (está no relatório dele) · conta aberta · conta fechada sem remessa · lançado (provavelmente depois da geração do repasse). Isso sugere a natureza da NC, o responsável (quem fechou a conta), a conta e o atendimento; o resumo aparece no resultado da conferência. Nomes de pacientes do Power BI ficam só na memória da sessão; CPF nunca é lido. A atualização da base pelo Power BI também guarda as unidades de cada código de prestador.

## Exportar competência em pastas (03/11/2026, v2.1.0-alpha.1)
Pedido: exportar a competência no padrão de pastas da rede. «Exportar competência (pasta)», no Fechamento e no painel do Início, gera `Comp_MM-AAAA.zip`:
- `REPASSE_MM-AAAA_CONTROLE.xlsx` — planilha do Fechamento (a planilha sozinha continua em «Exportar planilha de controle»);
- `Correção de prestador/correcao_prestador_unidade_[un].xlsx` e o PDF do prestador genérico de cada unidade;
- `Não conformidades/nc_comp_MM-AAAA.xlsx` — todas as NCs de todas as unidades;
- `Planilhas utilizadas para conferência/` — Power BI e laudos do Apolo, como foram carregados;
- `Relatórios para conferência/[USG|IMG]/Unidade [un]/medico_[cód]_[nome]_repasse_[usg|img]_unidade_[un].pdf`;
- `Conferência cruzada/[USG|IMG]/Unidade [un]/conferencia_medico_[cód]_unidade_[un]_comp_MM-AAAA_rodada_[id].xlsx`;
- `Controle da ferramenta/` — fluxo, rodadas e resumo (o antigo «pacote da competência»);
- `LEIA-ME.txt` — o que entrou e o que faltou.
A modalidade (USG ou IMG) sai da descrição do repasse e dos grupos do relatório. A unidade e os parâmetros vêm da última rodada de cada PDF. As planilhas de análise são refeitas na exportação, com a base de equivalências atual. Os arquivos originais só existem na memória da sessão: precisam estar carregados no Início.

## Planilhas de laudos e do Power BI guardadas por competência (04/11/2026, v2.1.0-alpha.2)
Pedido: «quando eu adiciono a planilha de laudos e a do Power BI elas não permanecem… quero que permaneça, mas opcional; o Power BI eu troco no meio do mês».
- **Guardar:** ao carregar, a planilha fica guardada **neste navegador para a competência do topo**. Ao recarregar a página ou voltar para a competência, ela já está carregada («💾 Guardada nesta competência desde…»).
- **Trocar:** basta carregar outra; a nova substitui a guardada (ex.: Power BI atualizado no meio do mês).
- **Opcional:** cada cartão tem «guardar automaticamente quando eu carregar», separado para laudos e Power BI, e os botões «Remover da competência» e «Guardar nesta competência». Em «Limpar arquivos…», a opção «apagar também as planilhas guardadas».
- **Troca de competência:** as planilhas guardadas da competência escolhida entram no lugar das da sessão.
- **Privacidade:** guarda-se o que a ferramenta leu, não o arquivo original. O **CPF do Power BI nunca é lido nem guardado**. Como há nomes de pacientes, as planilhas guardadas seguem a retenção das NCs (60 dias) e saem sozinhas depois.
- Os PDFs do MV continuam só na sessão.

## Regras compostas v2 (04/11/2026, v2.1.0-alpha.3)
Pedido: anotações «Melhorias e ajustes – Equivalências TUSS e Regras Compostas» (04/11/2026). Prévia aprovada: «aprovado, mesmo código duas vezes, percentual eu confirmo depois».
- **Cadastro com busca:** o título do laudo e cada código são procurados nos catálogos (Apolo e MV), com a descrição ao lado. Uma regra pode ter **vários títulos** (variações: «USG de mamas com Doppler», «Ultrassonografia das mamas com Doppler colorido»…) ou **palavras** («contém DOPPLER e um de PUNHO · OMBRO · JOELHO…»), para não cadastrar cada lado e cada articulação.
- **Composição por item:** cada item tem um rótulo, um código (ou alternativas) e a **quantidade** — o mesmo código pode ser esperado duas vezes (mamas: Doppler ×2).
- **Exceção por convênio (excludente):** por item, «não exigido» (UNIMED: punho/tireoide só com o Doppler) ou «quantidade diferente» (UNIMED: mamas com Doppler ×1). O código que vier a mais para aquele convênio aparece como **sobra** («Procedimento diverge», com o motivo da exceção).
- **Falta com quantidade:** «Composição incompleta — falta Doppler (esperado ×2, lançado ×1)».
- **Efetividade real:** a lista mostra, para cada regra, quantas contas e linhas ela conferiu nesta competência, quantas ficaram incompletas e quantas sobras, com exemplos. Antes de validar, «Simular nesta competência» mostra o mesmo cálculo sem gravar nada.
- **Simulação × conferência:** a simulação usa a regra + as já validadas. Regras que dividem o mesmo código (o Doppler 40901386 está em mamas, tireoide e articular) disputam o mesmo lançamento; por isso a soma das simulações feitas uma a uma, antes de validar, pode diferir um pouco do resultado com todas validadas. Simulada depois de validada, a regra bate exatamente com a conferência.
- **Regras no formato antigo** (título → códigos, com variação por convênio) continuam valendo, convertidas na leitura.
- **Fusão de imagem por percentual:** Bases → Classes → procedimentos equivalentes ganhou «Ou % do valor faturado» e «Ou % da unidade». Confirmado em 04/11/2026 (v2.1.0-alpha.4): **a fusão vale o percentual geral de repasse da unidade onde foi feita** (Bases → Unidades: 1 = 44%, 2 = 49%, 4 = 40%, 7 = 40%, 10 = 44%, 17 = 42%) sobre o valor faturado da linha. Unidade sem percentual cadastrado (ex.: 5) vira aviso no Fechamento. A configuração antiga (R$ 250,00) é trocada uma vez, automaticamente.
- **Competência 10/2026 real** (`test/compostas_comp10.mjs`): com as 5 regras das anotações validadas (TC abdome total, RM abdome total, USG mamas + Doppler, tireoide com Doppler, USG articular + Doppler), a cobertura de equivalências foi de 0% para 9,4% (304 de 3.219 linhas). TC abdome total sozinha conferiu 123 contas (244 linhas).

## Possíveis regras compostas na lista de pendentes (04/11/2026) — prévia enviada
Pedido: «olha aí o tanto de possíveis compostas que estão para serem validadas, por que não tem uma opção aí também para adicionar validações compostas?». Na base carregada, 164 títulos do Apolo têm 2 ou mais códigos pendentes; a maioria é «um ou outro» (mamografia digital × convencional), poucos são «um e outro» (Doppler mamas = USG mamas + Doppler).
- Prévia: botão «Criar regra composta com as selecionadas…» na barra; visualização «Agrupar por título» com três decisões por título (Juntos (composta)… · Um ou outro · Só o marcado); relações cobertas por regra saem de Pendentes («Cobertas por regra composta») e voltam se a regra for desativada.
- Aguardando aprovação.

## SOL-F35 — Controle por unidade: quem laudou × quem já tem repasse — IMPLEMENTADA na v2.1.0-alpha.5 (pedido de 09/11/2026)
Pedido: «Na unidade 1, quantos e quais prestadores fizeram laudos? Quantos já foram, quais eu já conferi e aceitei, quantos ainda faltam? Hoje eu abro a planilha de laudos, filtro a unidade e o US e anoto num papel os médicos para gerar o repasse no MV. Já esqueci um, e é um transtorno.»

**Objetivo:** a lista de quem precisa de repasse sai da planilha de laudos do Apolo (já guardada na competência), e não do papel. Nenhum prestador que laudou pode ficar sem repasse sem que a ferramenta avise.

### De onde vem a lista
- **Planilha de laudos do Apolo** da competência: cada laudo tem a unidade (BRANCH_NAME), a modalidade (MODALITY) e o médico.
- **Unidade:** o nome do Apolo é ligado ao código da unidade (1, 2, 4, 5, 7, 10, 17) pelo cadastro de unidades. Um nome novo pede para ser ligado uma vez, e a ligação fica guardada.
- **Grupo de repasse:**
  - **USG:** modalidade US, com o Doppler junto (Doppler é sempre do grupo de USG), em todas as unidades menos a 5;
  - **IMG:** as demais modalidades (RX, mamografia, densitometria, tomografia, ressonância…), em todas as unidades menos a 5;
  - **Curitiba (V3, unidade 5):** um grupo só, geral (sem separar USG e IMG), **mas só com o que a SRA paga** — decisão de 09/11/2026: «não faço em partes; faço geral, mas não todos os exames por prestador: alguns são pegos pela equipe da G.O. Laudos, eu pago só os que prestam serviço pela SRA; tem que seguir as regras de cadastro dos prestadores de Curitiba». Na unidade 5:
    - entra na lista só o médico com regra V3 no cadastro (Bases → Médicos V3);
    - os laudos contados seguem a regra V3 dele: modo percentual = todos os exames; modo valor fixo = só os grupos cadastrados (ex.: USG e ressonância), e os demais exames dele ficam fora da contagem;
    - médicos sem regra V3 (ex.: equipe da G.O. Laudos) aparecem recolhidos em «Outros médicos na unidade 5 — não pagos pela SRA», só para consulta, sem contar como pendência;
    - médico do Apolo sem cadastro na unidade 5 pede uma decisão uma vez: «presta serviço pela SRA (cadastrar como V3)» ou «não é pago pela SRA». A escolha fica no cadastro, com quem e quando.
- **Médico → prestador:** pelo cadastro de Bases, só com nome idêntico ou alias validado (RN-208). Médico do Apolo sem cadastro aparece numa linha própria, «sem cadastro», com os atalhos que já existem: «+ Cadastrar» e «Vincular como alias». A ferramenta nunca adivinha o prestador (RN-206). Residente entra pelo próprio cadastro (tipo residente).

### Situação de cada prestador × unidade × grupo (calculada, sem digitação)
| Situação | Quando | O que fazer |
|---|---|---|
| **Gerar no MV** | laudou no Apolo e ainda não há relatório do MV desta competência (nem PDF carregado nem rodada) | gerar o relatório de repasse no MV |
| **Relatório sem conferência** | há relatório, ainda sem rodada de conferência | rodar a conferência |
| **Conferido** | há rodada, sem aceite | revisar e dar o aceite |
| **Aceito** | a última rodada tem aceite | — |
| **Relatório sem laudo** | há relatório do MV, mas o médico não aparece no Apolo nessa unidade e grupo | **aviso, não é NC** (decisão de 09/11/2026): verificar prestador errado, outra unidade ou laudo em outro nome. Aparece no quadro, no Início e no Fechamento até ser resolvido ou marcado como verificado (com motivo) |
| **Fora do repasse** | cadastro «não realiza repasse» ou dispensado neste mês, com motivo e responsável | — (sai da contagem do que falta) |

Como os PDFs do MV só ficam na sessão, «já tem relatório» vale tanto para o PDF carregado agora quanto para qualquer rodada de conferência guardada da competência (prestador × unidade × grupo). Também há um «✓ gerado no MV» manual, para marcar o que já foi gerado e ainda não foi carregado.

### Onde aparece
- **Conferência → nova subaba «Prestadores por unidade»:** um quadro por unidade e grupo. Exemplo de resumo: «Unidade 1 · USG: 14 prestadores laudaram · 9 aceitos · 3 conferidos sem aceite · 2 a gerar no MV». Abaixo do resumo, a lista com cód., nome, nº de laudos no Apolo, nº de linhas no relatório do MV (quando houver) e a situação. Filtros por unidade, grupo e situação, com «Só o que falta» ligado por padrão. Clicar na linha abre a Conferência já com o relatório, a unidade e o médico escolhidos.
- **Início:** painel curto, com o total do que falta por unidade (ex.: «Unidade 1 · USG: faltam 5 (2 a gerar no MV)»).
- **Fechamento:** aviso quando alguém laudou e não tem repasse naquela unidade e grupo («2 prestadores laudaram na unidade 1 (USG) e não têm relatório»). O aviso não bloqueia o fechamento, mas fica na exportação de indicadores.
- **Fluxo (F16):** a etapa de geração dos relatórios no MV ganha a sugestão «Concluída — 0 a gerar», e a de conferência «12 de 14 com aceite», a partir desse controle.
- **Exportar «Lista para gerar no MV» (Excel/impressão):** prestador, código, unidade, grupo e nº de laudos. Substitui o papel.

### Regras e cuidados
- **Período:** os laudos são os da produção que a competência paga, ou seja, a mesma planilha usada na conferência.
- **Nº de laudos × nº de linhas do MV:** serve só de referência rápida. A conferência continua sendo a fonte do que bate ou não.
- **Privacidade:** o quadro e a exportação têm só médico, unidade e contagens, nunca nome de paciente.
- **Prestador genérico** (correção de prestador): fica fora da lista. Os laudos dele aparecem pelo médico que laudou.
- **Troca do Apolo pelo Cloov (SOL-F34):** usa os mesmos campos (unidade, modalidade, médico) e entra no mesmo mapeamento.

### Critérios de aceite
1. Com a planilha de laudos e nenhum PDF, a unidade 1 · USG lista todos os médicos com laudo US/Doppler na unidade 1, com a contagem igual ao filtro manual da planilha.
2. Médico do Apolo sem cadastro aparece como «sem cadastro», sem prestador sugerido.
3. Carregar o PDF e rodar a conferência muda a situação para «Conferido», e o aceite muda para «Aceito», sem digitar nada.
4. Na unidade 5, um grupo só, com os médicos V3 e só os exames que a regra V3 de cada um cobre; os demais médicos ficam em «não pagos pela SRA», fora da contagem.
5. O Fechamento avisa quem laudou e não tem relatório, e a lista «gerar no MV» sai em Excel.
6. «Relatório sem laudo» aparece como aviso, nunca como candidato a NC.

### SOL-F35 — implementação (v2.1.0-alpha.5, 09/11/2026)
- **Conferência → «Prestadores por unidade»** (subaba ao lado de «Conferir relatório»): abre só com a planilha de laudos. Unidades com o número do que falta; grupos USG (com Doppler) e IMG, e Curitiba num grupo só. Resumo (laudaram, aceitos, conferidos sem aceite, relatório sem conferência, a gerar no MV, relatório sem laudo, sem cadastro) e lista com «só o que falta (e avisos)» ligado por padrão.
- **Ações:** «✓ gerado no MV» (marca com quem e quando; continua na lista até ter rodada) · «Fora do repasse neste mês…» (motivo obrigatório) · «Marcar como verificado…» para relatório sem laudo · «Cadastrar ou vincular…» (o mesmo cadastro do Apolo de Bases, inclusive V3) · em Curitiba, «Não é pago pela SRA» (fica no cadastro, desfazível) · «Abrir conferência» (escolhe o PDF, se carregado, e a unidade).
- **Curitiba:** só médicos com regra V3; regra por valor fixo conta só os grupos cadastrados e mostra o resto em «fora da regra»; prestadores sem regra V3 e os marcados como não pagos pela SRA ficam em «Outros médicos — não pagos pela SRA» (recolhido, só consulta).
- **Exportar lista para gerar no MV (Excel)**: aba «Gerar no MV» e aba com todos; **Imprimir**: só o que falta, com coluna para ticar.
- **Início:** painel «Prestadores por unidade» com o que falta por unidade e grupo. **Fechamento:** avisos do grupo da subaba (quem laudou e não tem relatório; relatório sem laudo), sem bloquear, e o mesmo bloco na exportação de indicadores. **Fluxo (F16):** sugestão nas etapas «Gerar … no MV» de USG, IMG e Curitiba.
- As marcas da competência ficam neste navegador (`rm2.controleUnidades`), sem dado de paciente.
- **Teste com a competência 10/2026 real** (`test/prestadores_unidade.mjs`): todo laudo da planilha cai em exatamente um prestador da sua unidade e grupo; unidade 17 · USG: 22 médicos laudaram; com o PDF e a conferência do prestador 15, a situação passa a «Conferido» e, com o aceite, a «Aceito». Na unidade 5, 7 médicos do Apolo aparecem «sem cadastro» na base de teste (entre eles o Dr. Ian, que precisa estar ligado ao código dele no MV).

## SOL-F36 — Fluxo mensal sincronizado pela pasta da rede e divisão das unidades — IMPLEMENTADA na v2.1.0-alpha.6 (09/11/2026)
Pedido: «Uso junto de outro colaborador; dá para conectar o Fluxo mensal e sincronizar? Rede da empresa, os dois usam Edge, só o Fluxo por enquanto. Preciso saber se ele está fazendo a unidade 1 e eu faço outra.»
- **Sincronização:** um arquivo por competência (`fluxo_comp_MM-AAAA.json`) numa pasta da rede escolhida uma vez em cada computador (File System Access do Edge; «permitir sempre»). Com o Fluxo aberto: confere o arquivo a cada 30 s e grava logo depois de cada mudança. Sem acesso à pasta: barra amarela, mudanças ficam no navegador e vão quando voltar.
- **Mescla por etapa:** mudanças em etapas diferentes se juntam sozinhas; a mesma etapa alterada pelos dois desde a última sincronização pede escolha («ficar com a minha / com a da outra pessoa»), e as duas versões ficam no histórico.
- **Divisão do trabalho:** quadro unidade × grupo (USG, IMG, Curitiba) com «Assumir», «Liberar» e «Concluída» (sugerida quando tudo tem aceite, confirmada por clique). O «faltam» de cada unidade é o resumo de Prestadores por unidade (SOL-F35) gravado na pasta por quem está com ela, porque conferências e aceites ficam no navegador de quem fez.
- **Aviso, sem bloqueio:** ao escolher na Conferência ou em Prestadores por unidade uma unidade assumida por outra pessoa, «A unidade 1 · USG está com Ana desde 08:55» com «Continuar mesmo assim» (fica registrado) ou «Escolher outra unidade».
- **Últimas mudanças:** resumo do dia (quem mudou o quê e quando).
- **Vai para a pasta:** só o Fluxo mensal (etapas, status, datas, anotações, controle documental e quem assumiu cada unidade). Nada de paciente, PDF ou planilha.
- **Fica para depois:** Bases, Equivalências, NCs e conferências continuam por navegador. O Fechamento da competência inteira continua vendo só os aceites de quem o abre; juntar as conferências dos dois é uma etapa seguinte.
- Tamanho estimado: M.

### SOL-F36 — implementação (v2.1.0-alpha.6, 09/11/2026)
- **Pasta:** uma pasta da rede só para isso (ex.: `Repasse Médico\Fluxo compartilhado`), escolhida uma vez em cada computador em Fluxo → «Conectar à pasta da rede…». Não precisa separar por competência: a ferramenta cria um arquivo por competência (`fluxo_comp_MM-AAAA.json`) e usa o da competência do topo.
- **Barra no topo do Fluxo:** Sincronizado (pasta, há quanto tempo conferiu, quem gravou por último) · Liberar acesso (o Edge pede a permissão por sessão, ou «permitir sempre») · Sem acesso à pasta (mudanças ficam no navegador e sobem quando voltar) · Resolver conflitos. Botões Atualizar agora, Trocar pasta, Desconectar.
- **Quando sincroniza:** ao conectar, ao entrar no Fluxo, 0,8 s depois de cada mudança, e a cada 30 s com o navegador visível, se o arquivo mudou.
- **Mescla:** por etapa, controle documental de cada prestador, classificação, marcos, anotações e divisão. A primeira sincronização de cada pessoa nunca gera conflito: etapas ficam com a mudança mais recente e o histórico das duas, e o controle documental junta o que estiver preenchido. Depois, a mesma etapa mudada pelos dois pede escolha; «Decidir depois» deixa a barra em «Resolver».
- **Divisão do trabalho** (card no Fluxo): unidade × grupo (USG e IMG; Curitiba nas unidades V3). Assumir · Liberar · Concluir · Reabrir · «Assumir eu» (pede confirmação quando está com outra pessoa). Quem está com a unidade grava o resumo de Prestadores por unidade (faltam, a gerar, conferindo). «Últimas mudanças» lista quem fez o quê.
- **Aviso:** em Prestadores por unidade e na Conferência (ao escolher unidade e relatório), «A unidade X está com Fulano» com «Continuar mesmo assim» (registrado na divisão).
- **Prestadores por unidade:** a situação de quem tem rodada sem aceite passou a «Conferindo» (até o aceite), e o PDF carregado só conta como «relatório sem conferência» na unidade indicada no nome do arquivo (ex.: `_un17`), quando houver.
- Teste: `test/fluxo_sync.mjs` (dois usuários com navegadores separados e uma pasta simulada em disco).

## Conflitos de equivalência indicam possível regra composta; Divisão do trabalho em subaba (09/11/2026, v2.1.0-alpha.7)
Pedido: «equivalências em conflito devem indicar possível equivalência composta, onde um título pode ter mais de um TUSS (ULTRASSONOGRAFIA DO ESCROTO = USG BOLSA ESCROTAL ou USG ÓRGÃOS SUPERF.) e até título com Doppler que na conta tem o base e o Doppler juntos» e «coloque a Divisão do trabalho como subaba dentro de Fluxo».
- **Card de conflitos:** cada título mostra os códigos com a descrição do MV e a sugestão: **juntos** quando o título tem Doppler e um dos códigos é de Doppler; senão **um ou outro**. Botões: «Um ou outro» (cria regra composta validada, com justificativa, com os códigos como alternativas: o laudo sustenta uma linha) · «Juntos (composta)…» (abre o cadastro da regra composta já com o título e os códigos) · «Só um código…» (o antigo desfazer conflito).
- A regra composta validada vale por cima das relações simples. O título coberto sai da lista e da contagem de conflitos e aparece em «títulos resolvidos por regra composta». As relações validadas continuam no histórico.
- **Fluxo → subaba «Divisão do trabalho»**, com a barra de sincronização da pasta da rede; o Acompanhamento mantém só a barra.

## Regras compostas na lista de pendentes (09/11/2026, v2.1.0-alpha.8) — prévia aprovada
Pedido aprovado: «aprovado a prévia das compostas na lista de pendentes».
- **Visualização «Agrupar por título (2+ códigos pendentes)»** na lista de Equivalências: título, laudos no Apolo, códigos pendentes com caixa de marcação (todos marcados por padrão) e três decisões: «Juntos (composta)…» (abre o cadastro já preenchido), «Um ou outro» (regra validada com justificativa, códigos como alternativas), «Só o marcado» (valida o código marcado e desativa os outros do título com o motivo «outro código escolhido para este título»). 60 títulos por página, mais usados no Apolo primeiro.
- **Barra da lista:** «Criar regra composta com as selecionadas…» (títulos e códigos das relações marcadas; até 6 códigos).
- **Novo status «Coberta por regra composta»:** relação pendente cujo título e código já estão numa regra composta validada sai de Pendentes (com histórico); se a regra deixar de valer (pendente, desativada, removida), volta a pendente. Vale também para as regras já existentes. Filtro de status «Cobertas por regra composta» e contagem no topo.

- **Teste `competencia.mjs` intermitente (ambiente de teste):** na etapa «competência lembrada após recarregar», o navegador de teste às vezes recarrega o arquivo local com o armazenamento vazio (de 5 chaves sobram 3; nenhum código da ferramenta apaga as chaves — conferido com interceptação de removeItem/clear). O teste passou a mostrar o diagnóstico (S.comp, valor guardado, nº de chaves). Na alpha.5 e na alpha.6 passou 8 de 8; na alpha.8, cerca de 2 em 3. No site (https) e no uso normal o valor fica guardado; acompanhar.

## SOL-F37 — Sincronizar as equivalências TUSS pela pasta da rede — IMPLEMENTADA na v2.1.0-alpha.9 (pedido de 09/11/2026)
Pedido: «Outra coisa importante que teremos que sincronizar: equivalências TUSS.»
- Mesmo modelo do Fluxo (SOL-F36): um arquivo `equivalencias.json` na mesma pasta da rede (não é por competência), mescla de três vias por relação (código × título × escopo) e por regra composta, com conflito só quando os dois mudaram a mesma relação/regra (escolha com o histórico das duas).
- A validação continua exigindo responsável; o histórico de cada relação mostra quem validou em qual computador/navegador.
- Barra de sincronização também em Equivalências. O que muda uma relação passa a valer para o outro na próxima conferência (as rodadas já feitas não mudam).
- Depois: Bases (cadastro de prestadores, aliases, regras) pelo mesmo caminho.

### SOL-F37 — prévia (09/11/2026)
- Mesma pasta conectada no Fluxo (sem escolher de novo); arquivo único `equivalencias.json` (vale para todas as competências); barra de sincronização no topo de Equivalências; confere a cada 30 s e grava depois de cada validação.
- **Primeira vez, juntar as bases:** mostra as duas (sua × pasta) e o resultado antes de juntar; validada por um e pendente para o outro fica validada (com quem validou); o que só um tem entra; cópia da base para «Desfazer» em Configurações.
- **Decisões diferentes na mesma relação ou regra composta:** «Ficar com a minha / com a da outra pessoa / Decidir depois», com o histórico das duas. Códigos diferentes validados para o mesmo título caem no card de Conflitos («Um ou outro», «Juntos»).
- **Quem validou:** responsável obrigatório; marca «pela pasta» e histórico com a origem.
- **Conferências já feitas:** aviso «Ana validou 3 relações que mudam 2 conferências carregadas aqui» com «Rodar de novo as afetadas» (nada roda sozinho).
- Vai para a pasta: relações, regras compostas e catálogo TUSS. Não vai: contagem de laudos por título (calculada da planilha de cada um). Bases fica para a etapa seguinte.

## SOL-F38 — Ler os PDFs do MV (e as planilhas) direto da pasta da rede — IMPLEMENTADA na v2.1.0-alpha.9 (09/11/2026)
Pedido: «A ferramenta não segura os PDFs. Podemos indicar uma pasta (Relatórios MV › Competência 11-2026 › USG › Unidade 2 Jacarezinho) e, com um clique, atualizar a leitura depois das alterações no MV, sem ficar colocando toda hora?» A pasta raiz do aplicativo já tem: Bases de dados, backups, Fluxo mensal, Equivalência TUSS (sincronização).
- **Conectar a pasta raiz uma vez** (Edge/Chrome): a ferramenta usa as subpastas que já existem — Fluxo mensal (SOL-F36), Equivalência TUSS (SOL-F37, em vez de ao lado do Fluxo), Relatórios MV (nova) e, se quiser, Bases de dados para as planilhas de laudos e do Power BI.
- **Estrutura dos relatórios:** `Relatórios MV/Comp_11-2026/USG|IMG|Curitiba|Correção/Unidade 2 - Jacarezinho/*.pdf` — a mesma árvore da exportação «Comp_MM-AAAA». Competência, grupo e unidade vêm do caminho (nome da subpasta começa pelo número da unidade); não precisa renomear arquivo.
- **«Atualizar da pasta»** (Início e Conferência, por unidade e grupo ou tudo): lê só o que é novo ou mudou desde a última leitura (nome, tamanho, data); o PDF novo do mesmo prestador × unidade substitui o anterior; mostra «3 PDFs mudaram» e oferece «Rodar de novo as conferências afetadas».
- **Ao abrir a ferramenta:** os PDFs da competência do topo são lidos da pasta sozinhos (opcional), então recarregar a página não perde os relatórios.
- Os PDFs continuam só na rede da empresa; a ferramenta lê no navegador e não guarda cópia.
- Tamanho estimado: M.

## Pasta raiz do aplicativo: conexão, criação das pastas, leitura e sincronização (v2.1.0-alpha.9, 09/11/2026)
Pedido: «pode implementar a conexão com as pastas com as sincronizações necessárias; crie no Início a função de criar o caminho pasta por pasta, para não nomear errado e quebrar a leitura». Decisões: pasta do mês `Comp_11-2026`; laudos e Power BI em `Bases de dados › Comp_11-2026`.
- **Conexão única com a pasta raiz** (Início, Fluxo ou Equivalências → «Conectar a pasta raiz…»). Se a pessoa escolher uma subpasta (Fluxo mensal, Bases de dados…), a ferramenta avisa para escolher a de cima. A conexão antiga só com a pasta do Fluxo continua funcionando e o Início lembra de trocar pela raiz.
- **Nomes reconhecidos sem diferença de maiúsculas, acentos, hífen ou sublinhado:** Fluxo mensal · Equivalência TUSS (sincronização) · Bases de dados · backups · Competências › Comp_MM-AAAA (ou Comp_MM-AAAA direto na raiz) · Relatórios para conferência (ou RELATORIOS-MV-CONFERENCIA) › USG | IMG | Curitiba (ou V3) › «Unidade N - Nome» (vale o número do início) · Correção de prestador (ou CORREÇÃO DE PRESTEDOR) · PLANILHAS-… · Conferência cruzada · Não conformidades. Pasta que começa com «_» (ex.: _antigos) e temporários do Office são ignorados.
- **Card «Pasta raiz» no Início:** lembrete quando não conectada; «Liberar acesso» quando o Edge pede; «Atualizar da pasta»; «Criar pastas da competência MM/AAAA» (lista o que falta e cria só isso, com os nomes padrão: Bases de dados › Comp, Competências › Comp › Relatórios para conferência › USG/IMG › Unidade N - Nome de cada unidade, Curitiba, Correção de prestador › Unidade N, Conferência cruzada, Não conformidades); situação das pastas, da última leitura e das sincronizações.
- **Atualizar da pasta (SOL-F38):** lê os PDFs da pasta do mês (relatórios e correção) e as planilhas (Bases de dados › Comp ou PLANILHAS-… do mês; vale a mais recente de cada tipo; Power BI pelo nome «POWER BI/PBI/FATURAMENTO»). Só lê o que é novo ou mudou (tamanho e data); PDF regravado substitui o anterior e a ferramenta avisa para rodar a conferência de novo. Unidade e grupo vêm da pasta (a Conferência já abre na unidade: «Pela pasta da unidade: confirme»). Ao abrir a ferramenta com acesso liberado, a leitura é automática (desligável em `parametros.lerPastaAoAbrir`).
- **Equivalências sincronizadas (SOL-F37):** `equivalencias.json` na pasta Equivalência TUSS; mescla por relação (código × título × escopo) e por regra composta; primeira vez mostra as duas bases e o resultado antes de juntar (cópia da sua base para desfazer); decisões diferentes pedem escolha com o histórico das duas; relações que chegam validadas geram aviso para rodar de novo as conferências afetadas. Barra de sincronização no topo de Equivalências.
- Testes: `test/pasta_raiz.mjs` (pasta simulada em disco, dois usuários) e `test/fluxo_sync.mjs`.

## SOL-F39 — Pacote da competência controlando todas as pastas do mês — **IMPLEMENTADA como SOL-F45** (v3.0.0-alpha.14), nas pastas que são da ferramenta. As pastas de relatórios aos prestadores, NFs e repasses avulsos ficam com a equipe (09/11/2026)
Pedido: «Não precisa incluir tudo isso agora, mas é assim que organizo atualmente; o pacote da competência deve controlar tudo isso.» Pastas atuais do mês: CORREÇÃO DE PRESTEDOR · NAO CONFORMIDADES · NFs PAGAMENTO · PLANILHAS-CONFERENCIA · RELATORIOS-MV-CONFERENCIA · REPASSE 20% – PAULO ASSHAIAS FELIPE · REPASSE 25% – MARIANA MANFIO · REPASSE EUDES GUERRA – ECO · REPASSE IMG – RELATORIOS PRESTADORES · REPASSE PET – RELATORIOS PRESTADORES · REPASSE SEDAÇÃO – RELATORIOS PRESTADORES · REPASSE USG – RELATORIOS PRESTADORES · REPASSE V3 – RELATORIOS PRESTADORES.
- O pacote da competência (exportação e pasta do mês) deve conhecer e controlar todas elas: o que existe, o que falta, o que já foi enviado (relatórios aos prestadores, NFs de pagamento), ligado ao Fluxo e ao Fechamento.

## Filtros na lista de relatórios e relatório certo por unidade (09/11/2026, v2.1.0-alpha.10)
Pedido: «aqui vou precisar de filtros» (Início → Relatórios do MV carregados) e «teve um caso de um médico que puxa outro relatório, não o correto».
- **Filtros:** busca (prestador, código, arquivo, repasse), grupo (USG, IMG, Curitiba — da pasta ou do próprio relatório), unidade (inclui «Sem unidade»), finalidade e totais (conferem, com avisos, grupo diferente da pasta). Nova coluna «Unidade · grupo», com «(pasta)» quando veio da pasta; lista com rolagem própria.
- **Aviso «PDF de USG na pasta IMG»** (e vice-versa): o tipo do relatório (descrição e grupos das linhas) não bate com a pasta onde está — sinal de relatório errado na pasta.
- **Relatório certo por unidade:** trocar o relatório no seletor da Conferência (e da Correção) leva junto a unidade dele (da pasta ou do nome do arquivo); antes ficava a unidade do relatório anterior. O seletor mostra «· unidade N USG» quando veio da pasta. «Abrir conferência» em Prestadores por unidade escolhe o PDF do prestador naquela unidade e grupo (antes pegava o primeiro PDF do prestador).

## Vários relatórios do mesmo prestador: filtro por unidade e grupo e conferência em lote (09/11/2026, v2.1.0-alpha.11)
Pedido: «Como está puxando direto da pasta, há vários relatórios do mesmo prestador; o sistema não identifica sozinho.»
- **Seletor de relatórios da Conferência e da Correção:** filtros «Relatórios da unidade» e «Grupo» (USG, IMG, Curitiba — da pasta ou do próprio relatório), com «N de M relatórios»; a lista vem ordenada por unidade, grupo e nome e cada opção mostra «unidade N USG». Trocar o relatório leva junto a unidade dele.
- **«Conferir os N relatórios filtrados»** (com unidade e/ou grupo escolhidos): cada relatório é conferido na unidade dele, com a tolerância da tela e o médico do cadastro (ou todos os médicos da unidade, quando o prestador não tem vínculo nela); uma rodada para cada; os sem unidade ficam de fora com aviso. O aceite continua sendo um por um.
- **Rodar de novo as afetadas** (depois de validar equivalências): quando o PDF não é o mesmo arquivo, procura o do prestador na mesma unidade (antes podia pegar o de outra unidade com o mesmo nº de repasse).
- Teste: `test/conferencia_lote.mjs` (PDFs reais da competência 10/2026: prestadores 15, 3 e 7 têm USG na unidade 17 e IMG na unidade 1).

## SOL-F40 — Conferência mais dinâmica: decidir por causa, não por linha — IMPLEMENTADA na v2.1.0-alpha.12 (09/11/2026)
Pedido: «Ainda não consegui me ajustar ao fluxo de conferência: quando exporto a planilha, ainda tenho que verificar as ressalvas. Esperava algo mais dinâmico; talvez mudar a ordem das colunas; na prática está confuso.»
- **Dados reais (comp. 10/2026, todos os PDFs, equivalências de confiança Alta validadas):** 2.685 linhas conferidas sozinhas (~77%), 783 pendentes, 30 ressalvas. Mais de 90% das pendências vêm de pares título × código ainda não decididos: 368 «equivalência não validada», 366 «título validado para outro código», 255 «ambígua». Depois vêm linha repetida (175), convênio escrito diferente (44) e nome apenas semelhante (42).
- **Proposta:** (1) resultado em uma frase com barra de progresso («229 de 301 conferidas; faltam 6 decisões»); (2) «O que falta decidir» agrupado por causa, da que resolve mais linhas para a que resolve menos, com a ação na própria causa (validar e conferir de novo, um ou outro, lançamento errado → NC, aceitar convênio igual) e só o resto linha a linha; (3) tabela e Excel na ordem situação → paciente → data → MV → laudo → o que falta, com «só o que falta decidir» como padrão e a 1ª aba do Excel «O que falta decidir».
- Aprovado: «é isso mesmo, pode implementar».

### SOL-F40 — implementação (v2.1.0-alpha.12)
- **Resultado em uma frase** no topo: prestador · unidade, barra (conferidas · ressalva · pendentes · só no faturamento) e «X de Y linhas do MV conferidas · Z%. Faltam N decisões: A resolvem B linhas de uma vez, C linhas uma a uma, e D laudos sem lançamento para revisar como NC». Botões: Começar pelas decisões · Ver todas as linhas · Exportar Excel. Detalhes da rodada (relatório, período, volume, equivalências, comparação, Power BI) ficam num bloco recolhido.
- **O que falta decidir** (`causasDaConferencia`, motor): cada linha pendente entra em exatamente uma decisão. Em lote: equivalência não validada (Validar e conferir de novo · Não é equivalente), sem equivalência cadastrada (Cadastrar, validar e conferir de novo), título validado para outro código (Um ou outro — regra composta validada · Lançamento errado → NC), título em conflito (Resolver em Equivalências), convênio escrito diferente e data (Aceitar as N, com justificativa sugerida), composição incompleta, laudos sem lançamento (candidatos a NC), HM e classificação pendentes (Bases). Uma a uma: linha repetida, mais de um laudo plausível, outro médico, nome apenas semelhante, só no faturamento. «Ver as N linhas» filtra a tabela nas linhas da decisão. Decidir uma equivalência roda a conferência de novo sozinha.
- **Aceite** depois de «O que falta decidir» (decidir primeiro, aceitar depois).
- **Tabela:** Situação · Paciente · Data · Procedimento no MV · Laudo (Apolo) · O que falta / por quê · Vl Repasse; «só o que falta decidir» ligado por padrão; linha, origem, médico e marcadores no detalhe.
- **Excel:** 1ª aba «O que falta decidir» (decisão nº, o que decidir, ação sugerida, linhas na decisão, paciente, data, MV, laudo, convênios, valor, por quê), substituindo «Pendências»; aba «Conferência» na mesma ordem de colunas da tela.
- Teste com dados reais: `test/conferencia_causas.mjs` (prestador 15, unidade 17: 15 → 22 conferidas validando uma equivalência pela causa).

## Regra composta: laudo do mesmo estudo (09/11/2026, v2.1.0-alpha.13)
Pedido: «A paciente fez Ultrassonografia Transvaginal com Doppler (laudo do Apolo); na conta espera-se a transvaginal e o Doppler. Mas a mesma paciente tem outro laudo, Doppler de transvaginal, que é o mesmo estudo no mesmo dia: a regra valida o primeiro e dá o segundo laudo como faltante de lançamento.»
- Na conferência, um laudo sem lançamento do **mesmo paciente e dia** de um laudo que fechou uma regra composta é tratado como **do mesmo estudo** quando: (a) o título está na lista «Mesmo estudo» da regra, ou (b) o título tem equivalência validada para um dos códigos já lançados pela composição. Nesses casos a linha fica «Conferido» com o marcador «Laudo do mesmo estudo (regra composta)» e o motivo diz qual laudo e quais códigos.
- Sem (a) nem (b): deixa de ser um «Só no laudo» comum e vira a decisão «Laudo do mesmo estudo? «DOPPLER DE TRANSVAGINAL» no mesmo dia de «USG TRANSVAGINAL COM DOPPLER» (regra …: 40901300 + 40901386)», com «É o mesmo estudo (incluir na regra)» — inclui o título na lista «Mesmo estudo» da regra (sem tirar a validação; registro no histórico da regra) e confere de novo — ou «Não é → NC».
- A lista «Mesmo estudo» aparece na coluna de títulos da regra em Equivalências e é mantida ao editar a regra.

## Equivalências em planilha linha a linha e leitura das regras compostas (09/11/2026, v2.1.0-alpha.14)
Pedido: «Não estou entendendo a configuração das regras compostas; coloque uma opção de exportar a planilha de equivalências de maneira que eu possa visualizar linha a linha.»
- **Equivalências → «Exportar planilha (.xlsx)»** (o JSON continua em «Exportar base (.json)»). Abas: **Leia-me** (o que é cada aba e como ler uma regra composta) · **Relações** (1 linha por código TUSS × TITLE: status, descrição no MV, laudos no Apolo carregado, escopo, responsável, data, confiança, ambígua, regra que cobre, justificativa, última mudança) · **Regras compostas** (1 linha por regra, com «Como a regra funciona» em português) · **Itens das regras** (1 linha por procedimento esperado e por exceção de convênio: códigos aceitos, descrição, quantidade, convênio, o que muda) · **Títulos das regras** (1 linha por título que aciona cada regra: da lista, por palavras ou do mesmo estudo).
- **Na tela**, cada regra composta mostra a leitura curta abaixo do nome: «Espera na conta: 1× 40901114 (USG MAMAS - OP) e 2× 40901386 (DOPPLER…). No convênio UNIMED, Doppler é esperado 1×.»
- Os botões da base (importar, mesclar, exportar, nova relação) passaram a funcionar também na visualização «Agrupar por título».

## Regra composta: «Juntos» ou «Um ou outro» explícito (09/11/2026, v2.1.0-alpha.15)
Pedido: a regra do escroto («ULTRASSONOGRAFIA DO ESCROTO» ou «… DA BOLSA ESCROTAL») estava como 1× 40901204 **e** 1× 40901203; deveria ser 40901204 **ou** 40901203.
- **Lista de regras compostas:** botão «⇄ Um ou outro» / «⇄ Juntos» em cada regra com mais de um código. Mostra «Hoje» e «Fica» em português, pede justificativa, mantém o status (validada continua validada) e grava a troca no histórico. Rodar as conferências de novo para aplicar.
- **Cadastro da regra:** escolha «Juntos — a conta tem cada procedimento» / «Um ou outro — a conta tem um dos códigos» acima da composição; em «Um ou outro», os códigos preenchidos viram alternativas de uma linha só.

## Cadastro de regra composta em 4 perguntas (09/11/2026, v2.1.0-alpha.16) — prévia aprovada
Pedido: «essa tela também está muito confusa, preciso que seja mais fácil de entender»; prévia aprovada.
- **1. Quando o laudo do Apolo tiver o título…** títulos como etiquetas (busca acrescenta; ✕ tira). «Reconhecer por palavras do título» fica recolhido.
- **2. …a conta do MV deve ter:** «Todos estes procedimentos» (juntos) ou «Um destes procedimentos» (um ou outro). Cada procedimento entra pela busca TUSS e aparece com o código e a descrição do MV; «vezes − n +» só no modo «todos»; ✕ tira. Regras antigas com alternativas dentro de um item continuam aparecendo («40901220 ou 40901221»).
- **3. Exceção por convênio (opcional):** uma linha por exceção — «No convênio [UNIMED] o procedimento [Doppler] [não é cobrado / é cobrado N vez(es)]».
- **4. Outros laudos do mesmo exame (opcional):** títulos que não cobram outra linha (mesmo paciente e dia).
- **Como vai funcionar:** a regra em português, atualizada enquanto se preenche.
- **Mais opções** (recolhido): nome (preenchido com o 1º título), unidade, justificativa. Saem «nome curto» (vem da descrição do MV, sem cortar palavra), «alternativas na mesma posição» e as três caixas fixas de procedimento.
- Validação: «um destes» com um item e 2+ códigos é válido; Enter numa busca não fecha a tela. Descrição do código: catálogo das equivalências, catálogo TUSS geral ou o nome escolhido na busca.

## Conferência: tornar a regra alternante e «Só no laudo» como correção de prestador (09/11/2026, v2.1.0-alpha.17)
Pedido (print da decisão «Composição incompleta: ULTRASSONOGRAFIA DO ESCROTO»): «quero que seja um alternante» e «casos que só têm no laudo e não no MV podem indicar correção de prestador, que deve ser apontado assim como NC».
- **Composição incompleta** de regra «juntos» com 2+ códigos: botão «Tornar a regra alternante (um ou outro) e conferir de novo» na própria decisão (mostra hoje × fica, pede justificativa, mantém o status, grava no histórico da regra).
- **Só no laudo**, separado pelo Power BI quando carregado: «Lançados para outro prestador (Power BI): correção de prestador» (botão «Apontar correção de prestador» → NC «Prestador incorreto», com o prestador lançado pelo Power BI, o prestador certo = o do relatório, conta e atendimento) · «Só no laudo — sem lançamento / conta aberta / sem remessa / lançado depois» (Registrar NC com a natureza sugerida pelo Power BI; «É correção de prestador…» também disponível) · «Lançados no relatório do médico do laudo». Sem Power BI: uma decisão só com «Apontar correção de prestador…» e «Registrar NC (não lançado)».
- A frase do resultado diz «N laudo(s) sem lançamento para apontar (correção de prestador ou NC)».
- Teste com dados reais (`test/conferencia_causas.mjs`, com o Power BI de 10/2026): o «Só no laudo» do prestador 15 na unidade 17 veio como lançado para outro prestador → correção de prestador.

## Erros visíveis e «Processando…» (09/11/2026, v2.1.0-alpha.18)
Relato: «Correção de prestador não está funcionando» (Gilberto · unidade 2 USG; clicar em «Executar identificação» não mostrava nada). Com os arquivos reais da competência 10 (PDFs de correção, Power BI, PDF marcado como vindo da pasta USG da unidade 2) a identificação roda normalmente aqui — o erro depende dos arquivos do usuário e ficava só no console.
- «Executar identificação» e «Executar conferência» mostram «Processando…» enquanto rodam e, se algo falhar, a mensagem na tela («Não foi possível executar …: <motivo>»).
- Qualquer erro inesperado em qualquer tela passa a aparecer como aviso (continua no console).
- Mensagem recebida: «Cannot read properties of undefined (reading 'responsavel')» → corrigido na v2.1.0-alpha.19.

## Correção de prestador com regra composta (09/11/2026, v2.1.0-alpha.19)
Causa do erro «Cannot read properties of undefined (reading 'responsavel')» na Correção de prestador: quando o laudo compatível é confirmado por uma **regra composta** (e não por uma relação simples código × título), não existe «relação» com responsável, e o texto do detalhe tentava ler esse campo. Agora o detalhe diz «validado para 41001109 (regra composta «TC abdome total», responsável)». Teste novo em `test/compostas.mjs` (Correção de prestador com laudo de regra composta).

## SOL-F48 — HM fora da V3: nunca compõe o repasse e é notificado para exclusão — **IMPLEMENTADA na v3.0.0-alpha.22** (pedido de 23/11/2026; teste: `test/hm_fora_v3.mjs`)
Pedido: «Enquanto na unidade da V3 nós pagamos HM de USG, nas demais unidades o HM deve ser notificado para exclusão e não compõe valor para o repasse — todos os grupos de HM em todas as unidades (exceto V3).»

**O que já valia (SOL-F43):** fora da V3, o HM ficava na classe Excluído (fora do valor), não podia ser aceito para pagamento e aparecia em «NCs e correções no MV › HM a excluir do MV», com alerta quando continuava no MV depois da reconferência.

**Achado e corrigido:** a regra de classificação «descrição termina em «- HM»» nunca casava. A descrição é comparada sem hífen e sem acento, e o padrão exigia o hífen. Um HM lançado no grupo do exame (ex.: «US TIREOIDE - HM» no grupo ULTRASSONOGRAFIA) era tratado como exame: podia parear com o laudo e **ser pago**.
- Padrão novo da descrição: começa com «HM» ou termina em «HM» (`^HM |(^| )HM$`).
- Padrão novo do grupo: `HONORARIO|HONOR MED|(^| )HM( |$)`, que cobre 77 Raio X, 78 PF, 80 Ressonância, 81 Mamografia, 83 Densitometria e grupos abreviados («HONOR. MEDICO», «77 - HM RAIO X»).
- As configurações antigas são migradas sozinhas quando a regra ainda tem o padrão de fábrica. A regra que o usuário editou fica como está.

**O que mudou na notificação:**
- **Conferência:** todo HM fora da V3 ganha o marcador **«HM a excluir do MV (fora da V3)»**, que dá para filtrar. O motivo diz o grupo e o convênio: «HM a excluir do MV: fora da V3 nenhum HM é pago…». Os textos que falavam em «HM sem regra do prestador» passaram a dizer a regra.
- **Fechamento (USG e IMG):** aviso por prestador e unidade, por exemplo «unidade 17: 4 HM a excluir do MV (R$ 31,00), fora do valor: fora da V3 nenhum HM é pago».
- **Excel do prestador:** aba nova **«HM a excluir do MV»**, com atendimento, conta, remessa, paciente, data, código, descrição, grupo, convênio, valores e motivo. Pronta para pedir a exclusão.
- **Excel único da unidade (SOL-F45):** a mesma aba, com o prestador nas duas primeiras colunas.
- **V3 (unidade 5):** nada muda. O HM de USG Unimed continua pago (com o exame base, SOL-F46), e os outros HM seguem «HM V3 a excluir».

**Critérios de aceite** (`test/hm_fora_v3.mjs`, dados fictícios):
1. Na unidade 17, os HM dos grupos 78 PF (inclusive o de USG Unimed), 81 Mamografia, 77 Raio X e o «- HM» no grupo de USG ficam Excluídos, com o marcador. Para pagamento: só as USG.
2. «Aceito para pagamento» não muda a classe do HM.
3. Fechamento com o aviso e o valor sem HM; Excel do prestador e Excel único com a aba «HM a excluir do MV».
4. A configuração antiga com o padrão de fábrica é migrada.
5. Na V3, o HM de USG Unimed continua Devido, e o de mamografia, Excluído pela regra da V3.

## SOL-F46 — Regras de Curitiba (V3) na conferência cruzada — **IMPLEMENTADA na v3.0.0-alpha.21** (pedido de 23/11/2026; teste: `test/v3_curitiba.mjs`)
Pedido: «Regra para HM V3 […] Regras para qualquer prestador da V3 […] vc consegue adicionar essas informações à ferramenta ou terei de fazer manualmente?»

### O que o usuário definiu
- **HM que nunca é pago a ninguém, e a ferramenta precisa avisar para excluir:**
  - grupo de procedimento **77 - Honorario Medico Raio X**;
  - grupo **77 - Honorario Medico PF**;
  - grupo **81 - Honorario Medico Mamografia**.
- **HM pago, para qualquer prestador da V3:** só o HM de **USG** do convênio **Unimed**.
  - O valor é o mesmo da USG do prestador.
  - Entra no repasse sem precisar de laudo; basta o **exame base**.
- **Em Curitiba**, a conferência e a correção de prestador sempre levam em conta a coluna **TITLE** do Apolo.
- **Pacote de ressonância e de mamografia:** considerar e notificar.
  - Em alguns casos o pacote substitui o exame base do convênio **Bradesco**, que o MV lança a 100% por um erro que não dá para ajustar.
  - Vale o pacote, que traz o valor certo de repasse.
- **Modalidades da V3:** mamografia, ultrassonografia, raio-X, densitometria e ressonância. A V3 ainda não faz tomografia; quando fizer, entram as regras dos prestadores para ela.
- **Quem recebe:** são 5 prestadores da unidade (os médicos V3, cada um com a sua regra).
- **Médicos de Londrina que laudam na V3:** fazem os laudos que não são de USG e recebem **por produção**. A lista raramente muda:
  - 7873 Amanda Souza de Assis · 5 Gustavo Andrade De Margalho · 8049 Heloisa Martins Cardoso · 10175 Henrique Pini Sonomiya;
  - 11718 Lucas Franklin Amarante · 9033 Lucas Yamada · 8873 Lucca Maricato de Las Villas Rodrigues · 7 Marcelo Garcia Marini;
  - 15 Marcelo Miyazaki Yoshida · 10264 Melanie Eiko · 12 Nilton Paccola Lovato · 14 Paulo Asshaias Felipe;
  - 3 Rafael Ogasawara Ferreira · 9 Roberto Brazao Farinha · 13 Thales Cavallini Rossi · 10285 Wesley Americo Bergamin.

### Como ficou (conferência da unidade V3)
| Linha do MV | Situação | Classe | Aviso |
|---|---|---|---|
| HM dos grupos 77 Raio X ou 81 Mamografia (inclusive HM de USG Unimed lançado lá, com destaque) | HM — regra pendente · «HM V3 a excluir» | Excluído | «Curitiba (V3) — avisos para o MV» e «HM a excluir do MV» |
| HM do grupo 78 HONORARIOS MEDICOS PF que não é de USG Unimed (ressonância, particular…) | HM — regra pendente · «HM V3 a excluir» | Excluído | idem |
| HM de outro grupo que não é de USG/Doppler, ou não é Unimed | HM — regra pendente · «HM V3 a excluir» | Excluído | idem |
| HM de USG/Doppler Unimed **com** o exame de USG do mesmo atendimento (ou do mesmo paciente e dia) no relatório | Conferido · «HM V3 devido» | Devido | — |
| HM de USG/Doppler Unimed **sem** o exame base no relatório | **HM sem exame base** | Pendente (pode ser aceito com justificativa) | causa própria em «O que falta decidir» |
| Pacote de ressonância/mamografia (grupo PACOTE, ou descrição «PACOTE …» na V3) | Conferido · «Pacote V3 considerado» | Devido pelo Vl Repasse do MV | aviso com o exame que ele substitui |
| Exame base do mesmo paciente e dia do pacote, do convênio Bradesco e lançado a 100% | **Substituído pelo pacote** | Excluído | aviso |
| Linha de tomografia (ou outra modalidade que a V3 não faz) | segue a conferência | segue a conferência | «Modalidade que a V3 não faz» |

- **Modalidade pelo TITLE:** na unidade V3, a modalidade do laudo vem do título quando ele aponta uma só (ultrassom/Doppler → US, mamografia → MG, ressonância → MR, densitometria → OT, raio-X → CR, tomografia → CT); senão fica a MODALITY.
  - Vale para a conferência, a correção de prestador e Prestadores por unidade.
  - A MODALITY original fica guardada no laudo (`modalidadeApolo`).
- **Valor do HM (regra por valor fixo):** o HM Unimed paga o mesmo valor do laudo de USG do médico.
  - O campo separado «R$ por HM Unimed» saiu da tela.
  - Uma regra antiga com valor diferente passa a usar o valor do laudo de USG.
  - Na regra percentual (Dr. Ian), o HM já entrava no faturamento junto com a USG.
- **Pacotes no Fechamento → Repasse Curitiba:** somados ao total pelo Vl Repasse do MV, nos dois modos de regra, com linha própria no e-mail e na memória de cálculo.
- **Configurável:** Bases e regras → «Modalidades e HM V3», nos campos «Grupos de HM que nunca são pagos», «Trechos do pacote» e «Convênio do exame base substituído».
  - Padrão dos grupos: `HONORARIO MEDICO RAIO X|HONORARIO MEDICO MAMOGRAFIA`. O «78 - HONORARIOS MEDICOS PF» **não** entra em bloco (ver «Teste com os arquivos reais»).
  - Cada palavra do padrão precisa começar uma palavra do grupo do MV, sem diferença de plural nem do número do grupo.
- **Médicos por produção:** em Bases → Médicos V3, nova lista «Médicos de Londrina que laudam na V3 por produção», já com os 16 médicos.
  - Botões «Tirar», «Voltar à lista» e «+ Médico por produção»; a escolha fica em `regras.v3producao` do prestador.
  - Em Conferência → Prestadores por unidade, no grupo Curitiba, eles contam os laudos que não são de USG. Os de USG aparecem como «fora da regra».
  - O pagamento continua pelo relatório do MV, no Fechamento do IMG, na coluna da unidade 5.
- **Aviso na conferência:** quadro «Curitiba (V3) — avisos para o MV» logo abaixo dos totais.
  - Mostra os HM a excluir por grupo (com o valor), os HM sem exame base, os pacotes, as bases substituídas e as modalidades fora da V3.
  - Cada item tem o botão «Ver linhas», que filtra a tabela.

### Critérios de aceite (em `test/v3_curitiba.mjs`, com dados fictícios)
1. HM dos grupos 77 Raio X e 81 Mamografia = Excluído e listado para exclusão, mesmo quando é de USG Unimed. No 78 PF, só o HM de USG Unimed é devido.
2. HM de USG Unimed com o exame base no relatório = Devido, sem laudo; sem o exame base = Pendente, com causa própria.
3. Laudo com MODALITY errada e TITLE de ultrassom pareia com a linha de USG.
4. Pacote de ressonância = Devido; o exame base Bradesco a 100% do mesmo paciente e dia = Excluído («Substituído pelo pacote»).
5. Valor fixo: HM Unimed × valor do laudo de USG; pacote somado pelo valor do MV.
6. Lista padrão com os 16 médicos por produção; na unidade 5, contam só os laudos que não são de USG.

### Teste com os arquivos reais (competência 11/2026, produção 10/2026) — `test/curitiba_real_11-2026.mjs`
Material de 23/11/2026, na pasta `dados/comp_11-2026_curitiba/` (fora do Git): relatórios do MV de 10490 (Ian), 11467 (Gilson), 7 e 14 e a planilha de laudos. Sem a base de equivalências, os procedimentos ficam «pendente»; o teste mede o que é próprio da V3.

- **O HM de USG Unimed vem no grupo «78 - HONORARIOS MEDICOS PF»**, e não em «77».
  - É lá que estão os 544 HM do Ian (R$ 27.890,68) e os 21 do Gilson.
  - O mesmo grupo traz HM que não são pagos: 3 do Ian, particulares; 3 do Gilson e 5 do Marcelo (7), de ressonância.
  - Por isso, o PF saiu da exclusão em bloco: dentro dele, vale a regra geral (só USG/Doppler Unimed é devido).
  - Grupos de HM que apareceram: 78 PF, 80 HONORARIO MEDICO RESSONANCIA, 81 HONORARIO MEDICO MAMOGRAFIA e 83 HONORARIO MEDICO DENSITOMETRIA.
- **Exame base:** os 544 HM do Ian e os 18 HM de USG do Gilson acharam o exame de USG no relatório. Nenhum ficou «sem exame base».
- **HM a excluir:**
  - Ian: 6, R$ 287,40 (3 particulares no PF, 2 de mamografia e 1 de densitometria);
  - Gilson: 3 de RMN no PF, R$ 90,00 (o MV pagou R$ 30 cada);
  - Marcelo (7): 8 de ressonância, R$ 779,52.
- **Cálculo, simulando tudo aceito:**
  - Ian: 1.741 USG; R$ 100.962,16 + HM R$ 27.890,68 = R$ 128.852,84; menos 9,15% = R$ 117.062,81; × 70% = **R$ 81.943,96**.
  - Gilson (valor fixo lido do relatório: USG R$ 30, ressonância R$ 45, HM = USG): **R$ 7.635,00**, contra R$ 7.725,00 do MV. A diferença são os R$ 90,00 de HM de RMN.
- **TITLE:** dos 4.118 laudos de Curitiba, o TITLE e a MODALITY concordam.
  - Títulos com erro de digitação («ULTRASONOGRAFIA», «RESSNONÂNCIA») passaram a ser reconhecidos.
  - O pareamento ficou em 1.728 de 1.741 (Ian), 169 de 170 (Gilson), 226 de 227 (7) e 26 de 26 (14).
- **Achado:** o MV lançou uma USG para o Dr. Paulo (14), que só tem laudos de ressonância; o laudo dessa USG é de outro médico. A ferramenta marca «Laudo de outro médico», candidato a correção de prestador.
- **Prestadores por unidade (5):** o 7 conta 236 laudos por produção e o 14 conta 26.
- **Pacotes:** não houve nenhum nestes relatórios, então a regra do pacote ainda não foi vista em dado real.

### HM de USG Unimed = valor do exame base correspondente (regra para todos na V3, 23/11/2026)
Pedido: «caso o valor de USG mude, o de HM terá que ser o mesmo valor do exame base correspondente; regra para HM USG Unimed sempre, para todos na V3».
- **Regra de valor fixo:** o HM vale o valor da USG do médico para o convênio do exame base que a conferência achou, com a exceção por convênio, se houver.
  - Ex.: USG R$ 33,00, mas R$ 40,00 na Unimed → o HM Unimed vale R$ 40,00.
  - A conferência guarda o convênio do exame base na linha do HM (`baseConvenio`, também na rodada). Rodadas antigas usam o convênio do próprio HM, que é o mesmo do exame base, porque os dois são do mesmo atendimento.
  - O e-mail e a memória mostram «Honorários USG UNIMED: 9 × R$ 35,00 = R$ 315,00» e, se houver mais de um valor, a soma por valor.
- **Regra percentual (Dr. Ian):** sem mudança. O HM entra no faturamento da USG pelo valor do MV, como no e-mail de 10/2026.

### Cadastro dos médicos V3 (pedido de 23/11/2026: «cadastre esses médicos também»)
As regras foram lidas dos relatórios do MV de 11/2026 e entram sozinhas na configuração (migração `aplicarCadastroV3Padrao`, em `47-v3.js`).

| Cód. | Médico | Regra |
|---|---|---|
| 10490 | Ian Saraiva de Olanda Braga | percentual: 65/68/70% do líquido por volume (9,15% de impostos), HM Unimed no faturamento, densitometria 10% do bruto |
| 11467 | Gilson Yoiti Ogassawara | valor fixo: USG R$ 30,00 · ressonância R$ 45,00 |
| 6703 | Alexandre Romanus | valor fixo: USG R$ 33,00 · raio-X (RADIOLOGIA DIAGNOSTICA) R$ 6,00 · ressonância R$ 45,00 |
| 8016 | Elen Akiko Nakano | valor fixo: mamografia R$ 15,00, **R$ 10,00 no HOSPITAL UNIVERSITARIO** |
| 17771 | Matheus Leite Ramos de Souza | valor fixo: USG R$ 35,00 · mamografia R$ 15,00, **R$ 10,00 no HOSPITAL UNIVERSITARIO** |

- **Como entra:** uma vez por prestador (`regras.v3padrao`), com autor e data fixos, para os dois computadores gravarem o mesmo.
  - Não sobrescreve regra já cadastrada.
  - Apagar a regra depois não a traz de volta.
  - O prestador que não estiver no cadastro é criado.
- **Exceção por convênio** (nova no motor): cada grupo da regra fixa aceita `excecoes: [{convenio, valorLaudo}]`, com o convênio pelo trecho do nome.
  - O e-mail e a memória mostram a conta separada («220 × R$ 15,00 + 56 × R$ 10,00 (HOSPITAL UNIVERSITARIO)»).
  - Salvar a regra pela tela preserva as exceções do grupo.
- **Conferido com os relatórios reais:**
  - Alexandre: R$ 11.964,00, contra R$ 12.059,00 do MV. A diferença são 5 HM de raio-X pagos a 100% (R$ 95,00), que vão para «HM a excluir do MV». Os 30 HM de USG Unimed acharam o exame base.
  - Elen: R$ 3.905,00, igual ao MV, com os 3 pacotes de mamografia Bradesco a R$ 15,00. Nenhum exame base a 100% foi substituído.
  - Matheus: **R$ 9.225,00**, contra R$ 15.087,16 do MV. Saem 85 HM de mamografia lançados a 100% (R$ 5.168,00, «HM a excluir do MV») e 4 mamografias Bradesco lançadas a 100% (R$ 694,16), substituídas pelos pacotes. É o caso do erro do MV que o pacote corrige, visto pela primeira vez em dado real.
    - Entram 5 pacotes de mamografia Bradesco a R$ 15,00; um deles não tinha exame base a 100% e fica só no aviso.
    - Os 9 HM de USG Unimed (R$ 35,00, igual à USG) acharam o exame base.
- **Prévia aprovada em 23/11/2026 e implementada:** `docs/prototipos/v3-excecao-convenio.html`.
  - No diálogo «Regra da V3», cada grupo tem a coluna «Exceções por convênio», com «+ Convênio» (convênio com sugestões do cadastro e dos relatórios carregados, e R$ por laudo), «Incluir» e ✕.
  - Um convênio preenchido e não incluído também entra ao salvar.
  - O resumo da regra no cartão mostra as exceções.
  - Teste: `test/v3_curitiba.mjs`.

### Dr. Ian: nova extração e e-mail no formato do usuário (24/11/2026, v3.0.0-alpha.33)
O usuário mandou o e-mail de 10/2026 do Dr. Ian, a regra dele e uma nova extração do relatório de 11/2026 (`dados/comp_11-2026_curitiba/10490_v2.pdf`, emitido em 24/11/2026).
- **Regra:** já estava no cadastro padrão (65/68/70% do líquido por faixa, 9,15% de impostos, densitometria 10% do bruto). Nada a acrescentar.
- **E-mail:** passou a sair igual ao do usuário.
  - Começa com «Boa tarde a todos, segue relatório de produção para conferência.».
  - A conta da USG fica numa linha só: «Ultrassom: … mais HM … = … menos os impostos (9,15%) = … * 70% = …».
  - O exemplo de 10/2026 dá R$ 73.608,69 (teste em `test/v3_curitiba.mjs`).
- **CURSO CETRUS não compõe** (pedido de 24/11/2026: «CURSO CETRUS não compõe e deve ser sinalizado para exclusão»):
  - Na conferência da V3, a linha do convênio CURSO CETRUS vira «Convênio fora do repasse» (classe Excluído) e não disputa laudo.
  - Ela aparece no quadro «Curitiba (V3) — avisos para o MV» para excluir do MV e fica fora da contagem de exames e do cálculo.
  - Padrão em `HM_V3_PADRAO.conveniosExcluir = 'CETRUS'` (motor).
- **Nova extração** (com a regra do CETRUS):
  - Os 6 HM que a ferramenta mandou excluir na extração anterior (3 particulares no 78 PF, «2º VIA IMAGEM», 2 de mamografia e 1 de densitometria, R$ 287,40) saíram do MV.
  - **64 linhas de CURSO CETRUS** (R$ 0,01 cada) ficam de fora. 60 delas tinham laudo pareado, por isso não apareciam como «sem laudo».
  - Resultado: 1.674 exames. USG R$ 101.265,15 + HM R$ 27.612,12 = R$ 128.877,27 − 9,15% = R$ 117.085,00 × 70% = **NF R$ 81.959,50**.
  - Os 538 HM de USG Unimed acharam o exame base.
- **Para conferir com o manual:**
  - 9 USG ficaram sem laudo pareado.
  - 49 laudos «ULTRASSONOGRAFIA DA AXILA ESQUERDA» ficaram «só no laudo» (provável segunda página da USG de mamas; resolve com equivalência ou regra composta).
  - O usuário viu valores diferentes na conferência manual; os números dele ainda não vieram.

### A confirmar com o usuário
- O «Honorario Medico PF» pedido como «nunca pago» é o 78 PF dos relatórios? Nele está o HM de USG Unimed. Por isso a ferramenta paga só o de USG Unimed dele e exclui o resto. Se existir outro grupo «77 … PF», basta acrescentá-lo em «Modalidades e HM V3».
- Se o exame base do HM pode estar em outro relatório (de outro médico). Hoje é procurado só no mesmo relatório; sem ele, o HM fica pendente para decisão.
