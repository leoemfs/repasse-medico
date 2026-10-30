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

## SOL-F10 — Pasta da competência na rede — EM LEVANTAMENTO

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
