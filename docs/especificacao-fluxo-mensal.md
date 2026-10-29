# Especificação funcional — Aba de Controle Mensal do Repasse Médico

Recebida do usuário em 29/10/2026. Situação: **proposta visual em validação; não implementar antes da aprovação.**

## 1. Objetivo da funcionalidade
Criar uma nova aba na ferramenta de Repasse Médico para controlar o fluxo mensal de trabalho de todas as modalidades e unidades.
A funcionalidade deverá permitir visualizar as etapas de cada repasse, registrar o andamento das tarefas, acompanhar pendências, controlar prazos contratuais e monitorar a entrega dos relatórios e das notas fiscais até o encaminhamento ao Financeiro.
O fluxo deve ser flexível e configurável, pois algumas etapas podem sofrer alterações conforme a conclusão dos laudos, a regularização dos prestadores, as correções no MV e outras dependências operacionais.
A nova aba será um módulo de controle e acompanhamento. Não deverá substituir a ferramenta de Conferência Cruzada nem alterar automaticamente os dados do MV.

## 2. Organização geral da aba
Sugestão de nome: Fluxo Mensal (abreviadamente fluxo, talvez).
A tela deverá permitir selecionar a competência mensal e acompanhar o andamento dos processos por modalidade e unidade.

### 2.1. Grupos de controle
- Preparação do mês.
- Repasse de Ultrassonografia (USG).
- Classificação dos prestadores por produção.
- Repasse de Imagem (IMG) — demais modalidades após o fechamento de USG.
- Repasse de Curitiba.
- Repasse de Sedação.
- Não conformidades.
- Entrega de relatórios e controle de notas fiscais.

Os grupos devem possuir tarefas com status individual, prazo previsto, data de conclusão e campo de observações.

### 2.2. Status das tarefas
Não iniciada · Em andamento · Aguardando terceiros · Pendente de correção · Concluída · Não aplicável.
Permitir registrar a data de início, a data de conclusão, o responsável ou dependência externa, quando necessário, e observações.
O sistema não deve considerar uma tarefa concluída apenas porque a etapa anterior foi concluída. O avanço precisa refletir a execução real do trabalho.

## 3. Fluxo mensal de preparação
### 3.1. Solicitação da planilha de laudos do Apolo
No início do mês, solicitar ao Jhonas, por e-mail, a planilha de laudos extraídos do Apolo. Objetivo: obter a base necessária para iniciar as conferências e os cálculos de repasse.
Campos: solicitação realizada; data da solicitação; planilha recebida; data do recebimento; observações.

### 3.2. Atualização das regras dos prestadores
No início do mês, realizar a troca das regras de prestadores, alterando as regras de classe para as regras de Ultrassonografia, conforme o fluxo operacional vigente. A tarefa deverá permitir registrar a conclusão e eventuais pendências.

### 3.3. Solicitação dos relatórios das máquinas
Solicitar à Dra. Mariana e ao Dr. Paulo os relatórios das máquinas necessários ao cálculo dos repasses de 25% e 20%. O controle deve registrar a solicitação de cada relatório separadamente, seu recebimento e as observações pertinentes.

### 3.4. Conferência inicial de PET-CT
Com a planilha de laudos recebida, iniciar a conferência do repasse de PET-CT, cruzando a planilha de laudos com os dados do Power BI.
Atualmente, como os prestadores ainda não estão regularizados para a geração dos relatórios individuais, a conferência é realizada manualmente, fora da ferramenta. Após a regularização dos prestadores, a expectativa é realizar essa conferência por meio da ferramenta de Conferência Cruzada.
O prazo dessa tarefa deverá ser configurável, pois a conclusão de alguns laudos pode atrasar o início ou o encerramento da conferência.
Campos: início da conferência; situação da regularização dos prestadores; conferência manual ou via ferramenta; data prevista e data de conclusão; pendências e observações.

### 3.5. Repasse de ecodopplercardiograma — Dr. Eudes
No início do mês, antes do décimo dia útil, calcular o repasse da produção de ecodopplercardiograma do Dr. Eudes, unidade 10 — Alphasonic Apucarana. O cálculo é realizado manualmente, utilizando o Power BI e a planilha de laudos. O sistema deverá permitir acompanhar o prazo, o andamento do cálculo, a conferência e as observações.

## 4. Repasse de Ultrassonografia (USG)
### 4.1. Confirmação da data de fechamento
O fechamento do repasse de USG ocorre no quinto dia útil de cada mês. Antes do fechamento, enviar uma mensagem pelo WhatsApp corporativo confirmando a data limite para entrega das remessas e finalização dos procedimentos de USG.
Registrar: data prevista para o fechamento; confirmação enviada; data do envio; observações.

### 4.2. Geração do repasse
No quinto dia útil, gerar o repasse de Ultrassonografia no MV. A geração do repasse fecha os valores considerados para faturamento e impede alterações posteriores nessa etapa. Por isso, a geração precisa ser acompanhada como um marco importante do processo. Registrar a data efetiva da geração e permitir indicar se o repasse foi gerado.

### 4.3. Conferência e correções
Após a geração, realizar a conferência do repasse, identificar divergências, providenciar as correções necessárias e separar as não conformidades encontradas.
1. Geração do repasse. 2. Conferência dos valores e procedimentos. 3. Identificação das divergências. 4. Correções necessárias. 5. Consolidação das não conformidades. 6. Validação final para envio.
As tarefas podem ter status e observações independentes.

### 4.4. Envio dos relatórios e prévias
Após concluir as conferências e validações, encaminhar os relatórios de repasse e as prévias em planilha aos prestadores e gestores envolvidos. A entrega deve ocorrer até o prazo contratual aplicável, com antecedência mínima de cinco dias corridos em relação à data de pagamento. O sistema deve permitir acompanhar individualmente quem já recebeu os documentos e quem ainda está pendente.

### 4.5. Controle de notas fiscais e envio ao Financeiro
O pagamento do repasse de USG ocorre no dia 15 do mês, conforme o calendário operacional informado. A data de referência deverá ser configurável para refletir o calendário efetivamente adotado.
Para cada prestador, registrar: relatório e prévia enviados; data do envio; nota fiscal solicitada ou aguardada; nota fiscal recebida; data de recebimento; nota fiscal encaminhada ao Financeiro; data do encaminhamento; pendências e observações.
Indicadores: total de prestadores previstos; relatórios enviados e pendentes; notas fiscais recebidas e pendentes; notas fiscais encaminhadas ao Financeiro; prestadores com pendências documentais; situação geral do fechamento.
Os indicadores devem refletir os registros reais, sem considerar uma nota recebida como automaticamente encaminhada ao Financeiro.

## 5. Classificação dos prestadores para o repasse de IMG
Após o fechamento de USG, aproximadamente a partir do 15º dia útil, iniciar a preparação dos repasses das demais modalidades (Repasse de IMG). Antes de gerar esses repasses, é necessário calcular a produção bruta de USG dos prestadores para determinar a classe de remuneração aplicável aos demais laudos.
1. Apurar a produção bruta de USG por prestador. 2. Conferir os valores e a base de cálculo. 3. Classificar cada prestador nas classes A, B, C ou D, conforme as regras vigentes. 4. Registrar a classificação aplicada à competência. 5. Validar se todos os prestadores envolvidos possuem classificação definida. 6. Liberar a etapa de geração do repasse de IMG.
O sistema deverá permitir acompanhar a classificação individual dos prestadores e identificar quem ainda está pendente. Não implementar regras automáticas de classificação sem que os critérios de enquadramento estejam previamente definidos e validados.

## 6. Repasse de IMG — demais modalidades
### 6.1. Geração inicial dos repasses
Gerar os repasses dos prestadores no MV e identificar os relatórios que ainda estejam associados a um prestador genérico, em vez do prestador correto.
### 6.2. Identificação e correção dos prestadores
1. Extrair o relatório do prestador genérico indicado na conta. 2. Processar esse relatório na ferramenta de Conferência Cruzada. 3. Utilizar a ferramenta para identificar os registros reconhecidos e os registros faltantes. 4. Investigar manualmente os casos não identificados. 5. Corrigir os prestadores no MV. 6. Gerar os relatórios individuais dos prestadores corretos somente após as correções. 7. Processar os relatórios individuais na Conferência Cruzada.
A geração dos relatórios individuais definitivos depende da conclusão das correções no MV.
### 6.3. Conferência Cruzada e validações
1. Cruzamento dos dados. 2. Análise das divergências. 3. Investigação das causas. 4. Validações necessárias. 5. Identificação e consolidação das não conformidades. 6. Correções e devolutivas. 7. Validação final dos valores de repasse. 8. Preparação dos relatórios e prévias para envio.
O controle deverá permitir acompanhar a conclusão dessas etapas por prestador e unidade, sem exigir que todos os processos avancem simultaneamente.
### 6.4. Entrega e controle documental
Após a finalização, encaminhar os relatórios e as prévias em planilha aos prestadores e médicos envolvidos. Aplicar os mesmos indicadores de envio, recebimento de notas fiscais e encaminhamento ao Financeiro utilizados no fechamento de USG, respeitando os prazos específicos de cada unidade e modalidade.

## 7. Repasse da unidade de Curitiba
O repasse de Curitiba deve ser finalizado até o 20º dia útil do mês. Diferentemente das demais unidades, não há uma separação geral entre USG e demais modalidades. O pagamento é consolidado conforme o escopo de atuação de cada prestador: alguns recebem por produção geral e outros somente por exames específicos.
1. Preparação e geração dos repasses. 2. Conferência dos dados. 3. Correções de prestadores, quando necessárias. 4. Conferência Cruzada. 5. Análise das divergências e causas. 6. Tratamento das não conformidades. 7. Validação final. 8. Envio dos relatórios e prévias por e-mail.
Os relatórios devem ser entregues aos prestadores de Curitiba até o 20º dia útil, respeitando também a antecedência contratual mínima de cinco dias corridos em relação ao pagamento. O sistema deverá manter controles independentes, sem forçar a aplicação da separação USG/IMG a Curitiba.

## 8. Repasse de Sedação
Os repasses de sedação são pagos no final do mês. Fluxo: preparação do repasse; conferência da produção; validação dos valores; identificação de divergências e não conformidades; envio dos relatórios e prévias; controle das notas fiscais; encaminhamento ao Financeiro.
A entrega dos relatórios deve respeitar a antecedência contratual mínima de cinco dias corridos em relação à data de pagamento. Se a data prevista coincidir com um dia não útil, o prazo de entrega deverá ser recalculado de acordo com a data efetiva de pagamento e as regras aplicáveis. A data de pagamento e o prazo de entrega precisam ser configuráveis. Não presumir automaticamente que o prazo de sedação seja o mesmo do repasse de USG.

## 9. Controle das não conformidades
Acompanhamento próprio, relacionado à competência, unidade, modalidade e prestador.
Calendário operacional: USG — consolidação e entrega no fechamento do repasse, no 15º dia útil; IMG e demais modalidades — último dia útil do mês; Curitiba — conforme o fechamento específico e a data efetiva de entrega; Sedação — conforme o calendário de pagamento e as etapas de validação.
Campos: identificação ou descrição; prestador e unidade; modalidade e competência; causa identificada; área responsável pela devolutiva; data de abertura; prazo para resposta; situação da tratativa; data de conclusão; observações.
As não conformidades devem permanecer vinculadas ao respectivo processo de repasse. Quando necessário, permitir indicar se a pendência impactará o pagamento ou se deverá ser regularizada na competência subsequente.

## 10. Indicadores gerais por modalidade
Filtros por competência, unidade, modalidade e prestador.
- Operacionais: prestadores previstos; repasses não iniciados, em andamento e concluídos; conferências pendentes; correções pendentes no MV; não conformidades abertas e concluídas; prestadores aguardando validação; processos com prazo vencido ou próximo do vencimento.
- De entrega: relatórios e prévias a enviar e enviados; prestadores pendentes de envio; notas fiscais aguardadas, recebidas, encaminhadas ao Financeiro e pendentes de encaminhamento; prestadores com documentação incompleta.
- De prazo: data prevista e efetiva de fechamento; data limite de envio dos relatórios; data de pagamento; dias restantes; situação do cumprimento do prazo contratual.
Os indicadores devem distinguir tarefas concluídas de entregas efetivamente realizadas.

## 11. Campo de observações por seção
Cada grupo de tarefas possui uma área de observações independente por seção e competência (ex.: aguardando laudos, relatório solicitado não recebido, prestador não regularizado, correção pendente no MV, reprocessamento, alteração excepcional no calendário, pendência de outra área). Ocorrências de um prestador vão também no campo individual da tarefa.

## 12. Calendário mensal — opcional
Calendário visual dos prazos (fechamentos, classificação, NCs, envios, NFs, Financeiro, pagamentos), considerando dias úteis, feriados cadastrados e antecedência mínima em dias corridos; datas ajustáveis com exceções justificadas; sem datas fixas no código. Se aumentar muito a complexidade, priorizar lista de tarefas com prazos, indicadores e alertas de vencimento.

## 13. Requisitos importantes de implementação
1. Controle por competência, com histórico. 2. Configuração de prazos por modalidade e unidade. 3. Independência entre fluxos (USG, IMG, Curitiba, PET-CT, ecodopplercardiograma, sedação). 4. Rastreabilidade: datas previstas e realizadas, status, observações e alterações. 5. Dependências sem bloquear trabalho paralelo. 6. Controle documental individual por prestador. 7. Antecedência mínima de cinco dias corridos. 8. Acompanhar MV, Power BI, Apolo e Conferência Cruzada sem duplicar funções. 9. Alterar prazos e registrar exceções sem perder histórico. 10. Escopo inicial enxuto; calendário como evolução opcional.

## 14. Resultado esperado
Ao abrir a aba, identificar rapidamente: etapa de cada modalidade e unidade; o que foi concluído e o que falta; o que depende de terceiros ou de correções; prazos próximos ou vencidos; quais prestadores receberam relatórios; quais notas fiscais foram recebidas e encaminhadas; quais não conformidades seguem abertas; se o fluxo está dentro do prazo para o pagamento.

Orientação: antes de implementar, apresentar uma proposta visual da aba e validar a estrutura dos grupos, as dependências entre etapas e os indicadores. Não desenvolver automações complexas nem alterar a lógica atual de cálculo e conferência sem validação prévia.
