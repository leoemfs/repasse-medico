# Próximas funções — requisitos registrados

Situação: SOL-F1 e SOL-F2 implementadas (v2.0.0-alpha.2); SOL-F3 implementada (v2.0.0-alpha.3); SOL-F4 implementada (v2.0.0-alpha.4); SOL-F6, SOL-F7 e SOL-F8 implementadas (v2.0.0-alpha.5).

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

## SOL-F5 — Equivalências compostas e por convênio — EM LEVANTAMENTO (futuro)

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

## SOL-F9 — Power BI como base de dados da competência — REGISTRADO (memorizar)

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

## SOL-F10 — Pasta da competência na rede — A IMPLEMENTAR

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
| 6 | SOL-F19 Quadro Kanban por prestador · SOL-F20 Indicadores de fluxo (lead time, rodadas até o aceite) | médio | planejado |
| 7 | SOL-F21 Atualizar bases com o Power BI (com SOL-F9) · SOL-F5 Equivalências compostas | alto | planejado |
| 0 | SOL-F22 Arquivos da sessão: limpar e separar conferência × correção · SOL-F23 Excel da conferência reorganizado | baixo/médio | **implementado na v2.0.0-alpha.6** |

## SOL-F11 — Aceite na própria conferência — PLANEJADO
- **Hoje:** o resultado está na Conferência e o aceite fica em Rodadas (troca de tela a cada relatório).
- **Proposta:** botão «Registrar aceite» no resultado da conferência, com as mesmas regras (observação obrigatória com pendências, já descontadas as decisões). Rodadas continua como histórico.
- **Aceite:**
  - o aceite feito na conferência aparece em Rodadas e no Fechamento;
  - competência fechada bloqueia o aceite.

## SOL-F12 — «Marcar como enviado» no Fechamento — PLANEJADO
- **Hoje:** a prévia é copiada no Fechamento, mas o «relatório enviado» é marcado no controle documental do Fluxo (~40 vaivéns por mês).
- **Proposta:** depois de «Copiar prévia», o botão «Marcar como enviado» grava a data no controle documental do Fluxo. É o mesmo dado, sem cópia; o Fluxo continua sendo o dono.
- **Aceite:**
  - a situação muda para «E-mail enviado» nas duas telas;
  - desfazer é possível;
  - o Fluxo precisa estar iniciado na competência (senão, a tela avisa).

## SOL-F13 — Classificação do Fluxo lida do Fechamento — PLANEJADO
- **Hoje:** produção bruta e classe são digitadas no grupo «Classificação» do Fluxo, e o Fechamento já as calcula.
- **Proposta:** o bloco do Fluxo mostra o calculado e só registra a conferência humana («conferido por… em…»). O ajuste manual fica permitido, com justificativa.
- **Aceite:**
  - sem digitação duplicada;
  - divergência entre o ajuste manual e o calculado aparece como aviso.

## SOL-F14 — Lista documental do Fluxo lida de Bases — PLANEJADO
- **Hoje:** os prestadores do controle documental vêm de uma lista própria do modelo do Fluxo, separada das regras de Bases.
- **Proposta:** de onde vem cada lista:

  | Fluxo | Lista |
  |---|---|
  | USG | prestadores com faixa de USG |
  | IMG | prestadores que recebem IMG |
  | Curitiba | V3 / unidade 5 |
  | PET, Sedação, 20%, 25% e Eco | lista própria (não têm regra em Bases) |

- **Aceite:** um prestador cadastrado em Bases aparece no Fluxo do mês sem um segundo cadastro.

## SOL-F15 — Cobertura de equivalências e validação em lote — PLANEJADO
- **Hoje:** sem equivalência validada nada é conferido automaticamente (prestador 15: 67 de 67 pendentes).
- **Proposta:**
  - indicador de **cobertura**: % de linhas conferidas automaticamente por competência, no painel do Início e nos indicadores do Fechamento;
  - lista «títulos que mais destravam» (título × código pendente ordenado pelo nº de linhas afetadas), com validação em lote;
  - sugestão de uso: uma sessão de validação de 1 a 2 horas no início de cada competência.
- **Aceite:** a cobertura sobe de uma competência para a outra e aparece no histórico.

## SOL-F16 — Status sugerido nas etapas do Fluxo — PLANEJADO
- **Hoje:** o status das etapas é digitado mesmo quando a ferramenta já sabe o que aconteceu.
- **Proposta:** cada etapa ligada a um dado mostra a sugestão; um clique confirma. Nada conclui sozinho (decisão de 29/10/2026). Exemplos:
  - «12 de 14 prestadores com aceite»;
  - «NCs de USG: 4 abertas»;
  - «planilha de fechamento gerada».
- **Aceite:** a sugestão nunca altera o status sem confirmação; a confirmação fica no histórico da etapa.

## SOL-F17 — Candidatos a NC guardados na competência — PLANEJADO
- **Hoje:** os candidatos ficam só na memória e se perdem ao recarregar a página.
- **Proposta:** guardar os candidatos (e os dispensados) na competência, com a mesma retenção de 60 dias das NCs para os dados de pacientes.
- **Aceite:** depois de recarregar, a revisão continua de onde parou.

## SOL-F18 — Base compartilhada para a equipe — PLANEJADO
- **Hoje:** cada navegador tem a sua configuração, equivalências, NCs e fluxo. A equipe de dois troca backup à mão, com risco de retrabalho e divergência.
- **Proposta:** na pasta de rede (junto com a SOL-F10), um arquivo por base (configuração, equivalências, NCs, fluxo, competências), com revisão e «quem alterou».
  - Ao abrir, a ferramenta carrega a versão mais nova.
  - Ao salvar, avisa se a outra pessoa alterou o mesmo item desde a última leitura (conflito) e mostra as duas versões.
- **Aceite:** a validação feita por uma pessoa aparece para a outra; nenhuma gravação apaga a alteração da outra sem aviso.

## SOL-F19 — Quadro Kanban por prestador — PLANEJADO
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

## SOL-F20 — Indicadores de fluxo para a retrospectiva mensal (PDCA) — PLANEJADO
- **Indicadores:**
  - lead time por prestador (geração no MV → aceite → envio → NF);
  - nº de rodadas até o aceite;
  - tempo de espera por terceiros;
  - cobertura de equivalências;
  - NCs por natureza e faturista (reincidência);
  - dias de antecedência na entrega ao Financeiro.
- **Proposta:** uma aba «Retrospectiva» na competência, com comparação entre meses e um campo de «o que melhorar no próximo mês» (vira item do backlog).

## SOL-F21 — Atualizar bases com o Power BI — PLANEJADO (junto com SOL-F9)
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

## SOL-F26 — Início: tirar o anexo de equivalências e pôr os arquivos em três cards lado a lado — A FAZER HOJE
- **Retirar do Início** o card «Equivalências TUSS» (importar planilha de análise/base). A importação fica só dentro da aba Equivalências TUSS, que já tem esses botões.
- **Três cards lado a lado**, na mesma linha:
  1. Relatório de repasse MV (PDF);
  2. Laudos do Apolo (.xlsx);
  3. Power BI (.xlsx) — opcional.

  No celular, um embaixo do outro.
- **O resto da página não muda:** passos «Preparar o repasse», lista de relatórios do MV, atalhos para Conferência e Correção, painel da competência.
- **A decidir na execução:** o passo 3 da lista «Preparar o repasse» (equivalências validadas) continua como indicador, com link para a aba Equivalências.

## SOL-F27 — Fechamento: tabela «quebrando» ao rolar (nomes por cima do cabeçalho) — A FAZER HOJE
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
