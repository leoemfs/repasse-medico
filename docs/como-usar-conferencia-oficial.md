# Como usar: conferência oficial (o que entra no fechamento)

Vale a partir da v3.0.0-alpha.6 (SOL-F43). A prévia de conferência passou a ser a conferência oficial: o fechamento usa só o que ela autoriza a pagar.

## 1. As cinco classes

Toda linha do relatório do MV fica em uma classe. A classe vem da situação da conferência e das decisões que você registra.

| Classe | Entra no fechamento? | Quando |
|---|---|---|
| **Devido** | sim | situação «Conferido»: par único, nome seguro, mesma data, equivalência validada (ou regra composta / exame). HM entra aqui só quando a regra do prestador o inclui (V3: HM de USG/Doppler Unimed) |
| **Aceito** | sim | você aceitou para pagamento («Aceitar para pagamento…», antes «Considerar no repasse»), com justificativa. Fica registrado quem e quando |
| **Pendente** | **não** | qualquer linha ainda sem decisão: ressalva (convênio, data), ambíguo, só no faturamento, sem equivalência, composição incompleta, pacote, desconhecido, e «Resolvido no MV» ainda não reconferido |
| **Não conformidade** | **não** | NC registrada. Se a NC for marcada «não procede», a linha volta para a classe que tinha antes |
| **Excluído** | **não** | taxa, material e medicamento, que nunca compõem repasse; e HM sem regra do prestador, que deve ser excluído do MV. Não precisa de decisão |

- **Valor para pagamento** = Devido + Aceito.
- **Conferência da soma:** Devido + Aceito + Pendente + NC + Excluído = total do relatório do MV.

## 2. A tela, em abas
Depois de «Executar conferência», o resultado tem abas no topo. Elas ficam presas enquanto você rola a página.

| Aba | Para quê |
|---|---|
| **Prévia de conferência** | Abre primeiro. Mostra o valor para pagamento em destaque e o valor de cada classe; clicar num valor filtra a tabela. A tabela tem a coluna Classe, filtros e ações |
| **O que falta decidir** | As pendências agrupadas pela decisão que resolve mais linhas de uma vez (como antes) |
| **NCs e correções no MV** | O que devia ter saído do MV e continua no relatório; situação de cada NC; «Resolvidos no MV»; HM a excluir; candidatos a NC |
| **Aceite do relatório** | Encerra a conferência do relatório, com o resumo por classe. Com pendências ou alertas, pede observação |
| **Detalhes e equivalências** | Detalhes da rodada, comparação com a anterior e equivalências desta rodada |

## 3. Filtros e decisões em lote
- **Filtros:**
  - procedimento (código do MV, com a quantidade de linhas);
  - data;
  - convênio;
  - busca livre;
  - «só o que falta decidir»;
  - «com observação»;
  - classe (clicando no valor) e situação.
- A faixa azul mostra **quantas linhas e quanto valem** no filtro.
- **Em lote**, sobre as linhas pendentes do filtro:
  - «Aceitar para pagamento as N pendente(s)…», com uma justificativa para todas;
  - «Registrar NC das N pendente(s)…».

## 4. Decisões na linha (clique na linha para abrir)
- **Aceitar para pagamento…** — entra no fechamento (classe Aceito).
- **Apontar como NC…** — sai do fechamento (classe NC).
- **Resolvido no MV…** — você corrigiu no MV. A linha continua **Pendente** até:
  - você reimportar o PDF e a ferramenta confirmar que ela saiu;
  - ou você aceitar manualmente.
- **Este é o laudo certo** — nos casos ambíguos, ao lado de cada candidato. Vira «Aceito», com o laudo escolhido na justificativa.
- **Dispensar laudo…** — para «Só no laudo» que não precisa de lançamento.
- **Observação** — anotação livre na linha:
  - fica na competência e aparece nas próximas rodadas (marca ✎);
  - não muda a classe;
  - tem o filtro «com observação».
- **Remover decisão** — desfaz o aceite, o resolvido ou a dispensa. Para NC, use «não procede» na aba Não conformidades.

## 5. Reconferência (depois de corrigir no MV)
1. Corrija no MV: retire o procedimento da NC, exclua o HM sem regra, corrija o lançamento.
2. Gere o PDF de novo, carregue e execute a conferência.
3. Na aba **NCs e correções no MV**:
   - **Corrigida no MV / Confirmado pela reconferência:** a linha não está mais no relatório.
   - **Aguardando correção no MV:** ainda é o mesmo PDF; falta reimportar.
   - **Não corrigida: continua no MV** (alerta vermelho): o PDF é novo e a linha continua lá. A ferramenta já tira o valor do fechamento, mas o MV ainda vai pagar.
   - **HM que continua no MV** depois da reconferência: notificado para excluir.

## 6. Fechamento
- Cada prestador × unidade usa o **valor para pagamento** da rodada. Isso vale também para a produção de USG (classe A/B/C/D), a V3, a planilha de controle e o e-mail.
- Embaixo do valor aparece o detalhe: para pagamento, pendente, NC, excluído e o total do MV.
- **Rodadas feitas antes desta versão** continuam com o total do MV, para não mudar o que já foi fechado. Na competência aberta, o prestador mostra o aviso «valor pela regra antiga: confira de novo». Basta executar a conferência outra vez.
- Linhas pendentes geram aviso no prestador («N linha(s) pendente(s) fora do valor até decidir»).

## 7. Excel
- A aba «Resumo» traz o quadro por classe e o valor para pagamento.
- A coluna «Classe (fechamento)» está no catálogo de colunas e no modelo «Completo» (Configurações → Exportação).

## Vários exames do paciente no mesmo dia (v3.0.0-alpha.7)
Quando o paciente fez mais de um USG no mesmo atendimento (ex.: abdome total, transvaginal e tireoide) e as equivalências desses títulos ainda não estão validadas, a ferramenta usa o **título do laudo** para saber qual laudo é de qual linha do MV.

- No detalhe da linha, cada laudo candidato mostra **«título N%»**: quanto do título aparece na descrição do procedimento no MV.
- Se o laudo escolhido fica claramente acima dos outros (pelo menos 40% e 25 pontos acima de cada alternativa), a linha recebe o marcador **«Laudo escolhido pelo título»** e não fica «Mais de um laudo plausível».
- A linha **continua Pendente** enquanto a equivalência não for validada. Em «O que falta decidir», o grupo «Sem equivalência cadastrada» já traz o par certo: validando, as próximas conferências ficam «Conferido».
- Se os títulos não dizem o exame (ex.: «Exame de imagem»), a linha continua «Mais de um laudo plausível» e aparece na decisão linha a linha. Escolha o laudo certo no detalhe da linha.
