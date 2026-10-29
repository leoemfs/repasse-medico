# Próximas funções — requisitos registrados

Situação: **em levantamento** (não codificar até o usuário enviar as informações e aprovar a prévia visual).
Registrado em 29/10/2026 a partir da conversa com o usuário. Referência visual atual: Microsoft To Do (listas por tipo de repasse).

## SOL-F1 — Aba «Fluxo»

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

## SOL-F2 — Anotações

Hoje o usuário usa bloco de notas e anotações soltas no e-mail.
- Área de anotações **junto do Fluxo ou separada** (decidir na prévia).
- Proposta: notas livres com data, busca, e vínculo opcional a competência, tipo de repasse, item do fluxo, prestador ou não conformidade.

## SOL-F3 — Aba «Não conformidades»

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
