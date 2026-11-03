# Como usar o Fechamento

## Uma vez só: regras em Bases

1. **Bases → Prestadores e regras → Importar regras da planilha de controle**: lê a planilha `REPASSE_MM-AAAA_CONTROLE.xlsx` e preenche:
   - a faixa de USG de cada prestador: geral, +2%, residentes 35%, 40%, 49%, 50%, 55% ou 70%;
   - o BOARD;
   - quem recebe IMG, a classe fixa e os médicos V3.
2. **«Regras…» em cada prestador**: ajuste o que for diferenciado.
   - % de USG por unidade;
   - classe fixa;
   - tabela de residente;
   - exceções de valor no IMG (ex.: Melanie `MAMO=18`).
3. **Bases → Unidades e faixas**: CNPJ e % de USG (médicos e residentes) por unidade, as faixas de USG e os parâmetros do fechamento (CNPJ do BOARD e do PLANTÃO, limite de variação, tolerâncias).
4. **Bases → Classes e valores IMG**: cortes de produção (A, B, C, D), valores por laudo (convênios/particular e SUS) e procedimentos equivalentes (angiotomografia = 2 tomografias, perfusão R$ 250…). Vigência 2026.
5. **Bases → Convênios**:
   - «Importar do Power BI» traz os convênios como Convênio ou Particular;
   - marque o **SUS** à mão; o tipo marcado à mão nunca é trocado por uma importação.

## Todo mês

1. Rode a **conferência cruzada** de cada relatório do MV (USG e IMG), na competência do topo.
   - Trate as pendências: «Apontar como NC» ou «Considerar no repasse».
   - Registre o **aceite** em Rodadas.
2. Abra **Fechamento**.
   - **Repasse USG**: prestadores por faixa, com o valor de cada unidade (última rodada com aceite), BOARD, PLANTÃO, DESCONTOS e TOTAL GERAL. PLANTÃO, DESCONTOS e a observação do desconto você preenche no mês.
   - **Repasse IMG**: produção de USG, classe e valores por unidade. Também tem os médicos V3 e os blocos de NF complementar (PET-CT/Pluvicto e Curso Cetrus).
   - **Produção USG e classe**: produção por unidade e a classe resultante.
   - **Indicadores**: totais por unidade, faixa e classe; prestadores por situação; variações; NCs que impactam o pagamento.
3. **Situação** de cada prestador:

   | Situação | Quando aparece |
   |---|---|
   | **Verificar** | rodada sem aceite |
   | **Sem valores** | nenhum relatório |
   | **Conferido · a enviar** | rodada com aceite, ainda não enviada |
   | **E-mail enviado / aguardando nota** | relatório enviado no controle documental do Fluxo |
   | **Concluído** | NF encaminhada ao Financeiro |

4. **Avisos** (não bloqueiam):
   - percentual de USG fora da faixa;
   - valor de laudo do IMG diferente da classe;
   - convênio sem tipo;
   - variação acima do limite contra a competência anterior;
   - pendências da conferência.
5. **Copiar prévia**: copia o texto do e-mail do prestador, com uma NF por CNPJ e a data de pagamento.
6. **Exportar competência (3 abas)**: gera a planilha no layout da planilha de controle (REPASSE USG, REPASSE IMG e PRODUÇÃO USG CLASSE).
   - Enquanto algum prestador estiver sem aceite, a planilha sai marcada como **PRÉVIA**.
   - A exportação fica registrada como evidência nas etapas de envio do Fluxo mensal, sem concluí-las.
   - **Exportar indicadores** gera um arquivo à parte.

A classe de quem não tem classe fixa depende da produção de USG: rode e aceite todos os relatórios de USG da competência antes de fechar o IMG.

## Novidades da v2.0.0-alpha.11

- **Situação com ação manual:** clique no selo da situação. As opções são:
  - **Marcar para verificar…**, com motivo obrigatório. A marca vale por cima do cálculo até você usar **Tirar a marca**.
  - **E-mail enviado**, **NF recebida** e **NF encaminhada ao Financeiro**. Essas três gravam a data no controle documental do Fluxo mensal; clique de novo para desfazer.
- **NF complementar** nas sub-abas USG, IMG e Curitiba (V3): **+ NF complementar**.
  - O prestador vem da busca no cadastro.
  - A categoria tem sugestões; PET-CT, Pluvicto, Cetrus e Reajuste aparecem no IMG.
  - A unidade/CNPJ de emissão é obrigatória.
  - O valor é a quantidade × o valor unitário, ou o total direto.
  - Cada categoria lembra a unidade e o valor unitário usados por último.
  - Na planilha, sai um bloco por CNPJ, com uma coluna por categoria. Também entra na «Copiar prévia».
- **Sub-aba Repasse Curitiba (V3)** com os médicos V3 (eles saíram do IMG). As regras próprias da V3 virão com a SOL-F30.
- **Exportação no layout do modelo:**
  - USG em blocos por faixa;
  - abas IMG, Curitiba e Produção;
  - mesclagens, bordas, formato R$ e zoom de 85%.
