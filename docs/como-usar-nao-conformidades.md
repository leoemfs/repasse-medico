# Como usar as Não conformidades

## Onde as NCs nascem

1. **Pela análise.** Rode a conferência cruzada (ou a correção de prestador). No fim do resultado aparece o cartão **Possíveis não conformidades**. O sistema só separa os candidatos:
   - **Só no laudo:** laudo sem lançamento no MV. Sugestão: procedimento não lançado na conta.
   - **Só no faturamento:** lançado no MV sem laudo correspondente. Você escolhe a natureza.
   - **Procedimento diverge:** sugestão de procedimento lançado incorretamente.
   - **Laudo de outro médico** e **Prestador identificado** (correção): sugestão de prestador incorreto.
   - **Linha repetida / possível duplicidade:** sugestão de duplicidade.

   Clique em **Revisar na aba Não conformidades**, marque as linhas que são NC e use **Registrar selecionadas como NC…**. Ali você escolhe natureza, detalhe, responsável, competência e se impacta o pagamento. O que não for NC, **dispense**.

   Para apontar qualquer outra linha, abra o detalhe dela na tabela da conferência e clique em **Apontar como NC…**.

   Os candidatos ficam só na sessão: ao recarregar a página, rode a análise de novo. As NCs registradas ficam salvas.
2. **À mão.** Use **+ Nova NC**.
3. **Pela planilha manual.** Use **Importar planilha manual**. A planilha precisa ter as abas PARTICULAR, CONVENIOS (FAT) e Correção de prestadores.
   - A competência é lida do nome do arquivo (ex.: «09-2026»).
   - A natureza em texto livre vira a natureza padronizada, e o texto original fica nas observações.
   - Os responsáveis novos podem ser cadastrados em Bases → Faturistas.
   - Importar o mesmo arquivo de novo não repete NCs.

## Competência

É o mês de trabalho, a mesma do Fluxo mensal: a produção de setembro tem as NCs tratadas na competência de outubro. A NC que vem de uma análise já nasce na competência certa.

## No dia a dia

- **Abas** Particular, Convênios (faturamento) e Correção de prestadores, com filtros e busca. Clique na linha para editar; o histórico fica registrado.
- **Em lote:** marcar como enviadas ao Qualiex, definir responsável, mudar situação, levar para a competência seguinte (a cópia fica ligada à original) e excluir. Para uma NC que não se confirmou, prefira «Não procede»: ela continua contando nos indicadores.
- **Prazos de envio** vêm do Fluxo mensal:
  - USG: 15º dia útil;
  - IMG e demais: último dia útil;
  - Curitiba: 20º dia útil.

  O grupo «Não conformidades» do Fluxo mostra os totais da competência e tem um atalho para esta aba.

## Exportar para o Qualiex

**Exportar para o Qualiex (.xlsx)** gera as três abas com as mesmas colunas da planilha manual, mais as colunas situação, impacta pagamento, observações e data de envio, e uma aba **Indicadores** (por situação, categoria, natureza, responsável, unidade e médico). Depois de baixar, a ferramenta oferece marcar as NCs abertas como enviadas. Guarde na rede as exportações que precisar manter.

## Faturistas

Ficam em **Bases → Faturistas**: cadastro à mão, importação de uma planilha (você escolhe a coluna) ou do Power BI. Para o Power BI, a exportação precisa trazer a coluna de quem fechou a conta («Nome do Usuario que Fechou a Conta», como na exportação completa). Com essa coluna, o responsável de uma NC vinda da conferência é sugerido pelo atendimento.

## Privacidade

Tudo fica só neste navegador. Nome e ID/atendimento do paciente são apagados **60 dias após o registro** (ajuste em Configurações → Parâmetros). A aba avisa quando há dados que vencem em até 7 dias. Natureza, unidade, responsável e situação continuam para os indicadores. «Apagar agora os dados de pacientes desta competência» antecipa a limpeza. O backup só inclui as NCs se você marcar a opção.
