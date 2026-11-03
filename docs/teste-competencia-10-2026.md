# Teste da competência 10/2026 com os arquivos reais — v2.1.0-alpha

O teste foi rodado em 03/11/2026 com `node test/competencia10.mjs --simular`. Os arquivos estão em `dados/comp_10-2026/`, fora do Git. O teste percorre a ferramenta pela tela, como você faria, e leva cerca de 2 minutos para a competência inteira.

## Arquivos
- **15 PDFs do MV:**
  - USG da unidade 17: médicos 3, 7, 15, 13447 e 16211;
  - IMG da unidade 1: médicos 7, 15, 10175, 10264 e 11718;
  - V3 da unidade 5: médicos 6703, 8016 e 10490;
  - correção de prestador das unidades 10 e 17, prestador genérico 2.
- **Apolo:** 27.412 laudos.
- **Power BI:** 32.242 lançamentos, com quem fechou a conta, conta fechada e remessa.

## Resultado

| Etapa | Resultado |
|---|---|
| Leitura dos PDFs | 15 de 15 lidos; o total extraído é igual ao total do PDF em todos |
| Prestador genérico (2) | os 2 PDFs foram sozinhos para a Correção de prestador |
| Médico do laudo pelo cadastro | 12 de 13 conferências. Na Melanie (10264) o nome do MV («MELANIE EIKO A L M BUTARELLO») difere do Apolo («Melanie Eiko Aranda Lopes Makiyama Butarello»), e a ferramenta oferece «Vincular como alias» |
| Conferências com aceite | 13 de 13 |
| Fechamento | 10 prestadores de USG e IMG e 3 da V3; planilha exportada |
| Erros na tela | nenhum |

### Fechamento × planilha de controle de 10/2026
O Fechamento usa o valor do relatório do MV que você enviou. Três prestadores batem exatamente com a planilha de controle, e sete diferem:

| Repasse | Prestador | Unidade | Ferramenta (PDF) | Planilha de controle | Diferença |
|---|---|---|---|---|---|
| USG | 3 Rafael | 17 | 2.693,49 | 2.693,49 | ✓ |
| USG | 7 Marcelo Marini | 17 | 8.331,42 | 8.084,46 | +246,96 |
| USG | 15 Marcelo Miyazaki | 17 | 6.008,88 | 5.740,92 | +267,96 |
| USG | 13447 Bruno | 17 | 1.317,23 | 1.274,87 | +42,36 |
| USG | 16211 Matheus Cazula | 17 | 124,94 | 160,30 | −35,36 |
| IMG | 7 Marcelo Marini | 1 | 849,00 | 849,00 | ✓ |
| IMG | 10264 Melanie | 1 | 397,80 | 397,80 | ✓ |
| IMG | 10175 Henrique | 1 | 9.659,92 | 7.308,20 | +2.351,72 |
| IMG | 15 Marcelo Miyazaki | 1 | 12.329,15 | 10.837,96 | +1.491,19 |
| IMG | 11718 Lucas | 1 | 1.910,24 | 0,00 | +1.910,24 |

**A confirmar:** as diferenças podem ter três causas:
- os PDFs serem de uma geração diferente da usada na planilha;
- correções feitas depois da geração (correção de prestador, NCs);
- ajustes manuais na planilha.

A ferramenta não altera os valores do MV.

### V3 (Curitiba)
- **Dr. Ian (10490), regra percentual:** 1.543 exames de USG (com Doppler) · USG bruto 93.158,47 · HM Unimed 21.907,88 · menos 9,15% = 104.537,78 · 70% ≈ 73.176,45, mais densitometria 10% (8,33) = **NF 73.184,77**.
  - O e-mail que você mandou de exemplo dava 73.608,69, com 1.539 exames e USG 93.838,16. O HM Unimed é igual (21.907,88), mas o USG bruto não bate.
  - Esses números do e-mail não batem nem com este PDF do MV nem com o Power BI (1.542 · 92.708,85).
  - **Pergunta:** de onde saíram 1.539 e 93.838,16?
  - 2 linhas de raio-X estão sem regra no cálculo, e 2 HM foram marcados para exclusão.
- **Dr. Alexandre (6703), valor fixo:** USG 67 × 33 = 2.211,00 · HM Unimed 14 × 33 = 462,00 · ressonância 115 × 45 = 5.175,00 → **NF 7.848,00**. O MV traz 8.621,00.
  - Os **78 exames de raio-X estão sem regra**.
  - **Pergunta:** qual o valor do RX do Dr. Alexandre?
- **Dra. Elen (8016):** sem regra cadastrada, então vale o valor do MV (4.366,60).
  - O relatório tem mamografia (198), pacotes (2) e HM de mamografia (27).
  - **Pergunta:** qual a regra dela?

### Equivalências e cobertura — o gargalo
- **Cobertura automática da competência: 0%.** Nenhuma relação título × código está validada, então nada é confirmado sozinho (RN-206). Pelo mesmo motivo, a correção de prestador não identificou ninguém nas unidades 10 e 17.
- «O que mais destrava» lista **273 pares**. Os que mais travam são:
  - ULTRASSONOGRAFIA MAMÁRIA × 40901114 (425 linhas);
  - ULTRASSONOGRAFIA TRANSVAGINAL × 40901300 (244);
  - ULTRASSONOGRAFIA DO ABDOME TOTAL × 40901122 (218);
  - MAMOGRAFIA DIGITAL BILATERAL × 40808041.
- **Simulação** (não é validação real): validar os **40 pares do topo** leva a cobertura de **0% para 71,2%** (2.291 de 3.219 linhas). Por prestador:

  | Prestador | Cobertura |
  |---|---|
  | 16211 | 100% |
  | 8016 | 87,9% |
  | 10490 | 86,9% |
  | 10175 | 78,4% |
  | 6703 | 63,8% |
  | 7 | 52,5% |
  | 11718 | 48% |
  | 13447 | 47,5% |
  | 3 | 40,7% |
  | 15 | 31,3% |
  | 10264 | 20% |

- **A correção de prestador** passa a identificar 39 linhas (8 médicos) na unidade 10 e 59 (12 médicos) na unidade 17, com 3 conflitos em cada.

### Não conformidades e Power BI
- **2.845 candidatos** em 15 análises. A maior parte, 2.242, vem da conferência da Melanie: sem o vínculo do nome (alias), ela rodou com «todos os médicos da unidade». Com o alias, esse número cai para dezenas.
- **Por tipo:** «Só no laudo» 2.351, duplicidade 305, «Só no faturamento» 130, laudo de outro médico 59.
- **Natureza sugerida pelo Power BI:**
  - não lançado: 1.807;
  - prestador incorreto: 560;
  - lançado depois da geração: 43;
  - outros 435 candidatos: duplicidade (305) e «Só no faturamento» sem natureza sugerida (130).
- **Responsável:** sugerido em 2.305 candidatos (quem fechou a conta).

## O que fazer para a próxima competência
1. **Validar equivalências** em Equivalências → «O que mais destrava», de cima para baixo. Os 40 primeiros pares já cobrem cerca de 70% das linhas.
2. **Vincular aliases** dos médicos com nome diferente no MV e no Apolo, como a Melanie. O vínculo pode ser feito na própria Conferência.
3. **Cadastrar as regras da V3:**
   - valor do RX do Dr. Alexandre;
   - regra da Dra. Elen;
   - regras do Dr. Augusto e dos demais.
4. **Explicar as diferenças** entre os PDFs e a planilha de controle, e a origem dos números do e-mail do Dr. Ian.
