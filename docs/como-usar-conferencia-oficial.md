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
| **Excluído** | **não** | taxa, material e medicamento, que nunca compõem repasse; e HM: **fora da V3 nenhum HM é pago**, de nenhum grupo (raio-X, mamografia, ressonância, PF, USG…); na V3, só o HM de USG Unimed. O HM excluído é notificado para exclusão do MV (marcador «HM a excluir do MV», aviso no Fechamento e aba no Excel). Não precisa de decisão |

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
| **Histórico e detalhes** | Rodadas deste relatório (desde a alpha.20), detalhes da rodada, comparação com a anterior e equivalências desta rodada |

## 3. Filtros e decisões em lote
> Desde a v3.0.0-alpha.20, os filtros ficam no botão «Filtros» e as ações em lote aparecem quando você marca linhas ou escolhe um filtro. Veja `como-usar-navegacao.md`.

- **Filtros:**
  - procedimento (código do MV, com a quantidade de linhas);
  - data;
  - convênio;
  - busca livre;
  - título do laudo e médico do laudo;
  - intervalo de datas: escolha «Data» e «até»;
  - «só o que falta decidir»;
  - observação: «Com observação» ou «Sem observação»;
  - classe (clicando no valor) e situação.
- A faixa azul mostra **quantas linhas e quanto valem** no filtro.
- **Em lote**, sobre as linhas pendentes do filtro:
  - «Aceitar para pagamento as N pendente(s)…», com uma justificativa para todas;
  - «Registrar NC das N pendente(s)…»;
  - «Dispensar os N laudo(s) «Só no laudo»…», para os laudos sem lançamento que não precisam de lançamento;
  - «Observação nas N linha(s)…»: o mesmo texto em todas as linhas do filtro.

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
  - tem o filtro «Com observação» / «Sem observação»;
  - sai no Excel, na coluna «Observação (na linha)», com autor e data;
  - o quadro do aceite mostra quantas linhas têm observação;
  - ao apontar a linha como NC, a observação já vem nas Observações da NC;
  - segue a retenção dos dados de pacientes das NCs: passado o prazo, o texto é apagado e ficam autor e data;
  - é só interna: não vai para o e-mail nem para a prévia do prestador.
- **Remover decisão** — desfaz o aceite, o resolvido ou a dispensa. Para NC, use «não procede» na aba Não conformidades.

## 5. Reconferência (depois de corrigir no MV)
1. Corrija no MV: retire o procedimento da NC, exclua o HM (fora da V3, todo HM), corrija o lançamento.
2. Gere o PDF de novo, carregue e execute a conferência.
3. Na aba **NCs e correções no MV**:
   - **Corrigida no MV / Confirmado pela reconferência:** a linha não está mais no relatório.
   - **Aguardando correção no MV:** ainda é o mesmo PDF; falta reimportar.
   - **Não corrigida: continua no MV** (alerta vermelho): o PDF é novo e a linha continua lá. A ferramenta já tira o valor do fechamento, mas o MV ainda vai pagar.
   - **HM que continua no MV** depois da reconferência: notificado para excluir.
   - **Corrigida: lançada no MV** (desde a v3.0.0-alpha.9): a NC «não lançado» de um laudo «Só no laudo» cujo procedimento o MV lançou depois. A linha nova segue a própria classe (normalmente Devido); a NC não passa para ela.

**Linha repetida no MV** (mesma conta, atendimento, código e data): cada repetição tem decisão própria. «Esta é a repetida → NC» tira do fechamento só a duplicata; a cobrança legítima continua Devido.

**Reconferir em um clique** (desde a v3.0.0-alpha.10): no topo do resultado, «Reler o PDF da pasta e conferir de novo» (com a pasta raiz conectada) ou «Carregar o PDF novo e conferir de novo». A conferência roda de novo com a mesma unidade, o mesmo médico, a mesma tolerância e na mesma aba.

## 5a. Roteiro deste relatório (desde a v3.0.0-alpha.26)
Na Conferência, o cartão **«Roteiro deste relatório»** mostra em que passo o relatório escolhido está e o botão do próximo passo:

1. **Versão hospitalar no MV:** gere o PDF com o valor total e salve na pasta (ou carregue no Início).
2. **Conferir e decidir:** aceite para pagamento, registre NC ou marque «Resolvido no MV» o que vai corrigir lá.
3. **Corrigir no MV:** o que você marcou como «Resolvido no MV» ou NC e ainda está no PDF conferido.
4. **Gerar de novo e reconferir:** com um PDF novo deste relatório, confira de novo. As decisões continuam valendo.
5. **Aceite do relatório.**
6. **Versão final e envio:** tire no MV a versão sem o valor total e sem a %, envie com a prévia e marque **E-mail** na linha do prestador em Fechamento e envio.

Você não preenche nada a mais: o passo é calculado pelo PDF lido, pelas rodadas, pelas decisões, pelo aceite e pelo e-mail marcado. Abaixo de «O que conferir», cada relatório da lista mostra o passo em que está («passo 4 de 6», «✓ enviado»).

A versão final do MV não precisa ser carregada na ferramenta: o valor que vale é o da rodada aceita.

## 6. Fechamento
- Cada prestador × unidade usa o **valor para pagamento** da rodada. Isso vale também para a produção de USG (classe A/B/C/D), a V3, a planilha de controle e o e-mail.
- Embaixo do valor aparece o detalhe: para pagamento, pendente, NC, excluído e o total do MV.
- **Rodadas feitas antes desta versão** continuam com o total do MV, para não mudar o que já foi fechado. Na competência aberta, o prestador mostra o aviso «valor pela regra antiga: confira de novo». Basta executar a conferência outra vez.
- Linhas pendentes geram aviso no prestador («N linha(s) pendente(s) fora do valor até decidir»).

## 7. Excel
- A aba «Resumo» traz o quadro por classe e o valor para pagamento.
- A coluna «Classe (fechamento)» está no catálogo de colunas e no modelo «Completo» (Configurações → Exportação).
- Desde a v3.0.0-alpha.10:
  - o botão mostra «Processando…» enquanto o arquivo é montado;
  - com algum filtro na tabela, aparece «Exportar só o filtrado (N)». O arquivo termina em `_filtrado.xlsx`, e a aba Informações diz qual filtro foi usado.

### Excel único da unidade (desde a v3.0.0-alpha.17)
Uma planilha de controle por unidade e grupo (IMG, USG ou Curitiba), com todos os prestadores.
1. Na Conferência, escolha **«Relatórios da unidade»** e **«Grupo»** no filtro dos relatórios.
2. **«Conferir os N relatórios filtrados»** confere todos de uma vez. Cada um vira uma rodada.
3. **«Excel único: IMG · unidade N»** gera o arquivo. O mesmo botão está em **Prestadores por unidade**, no título da unidade e do grupo.

O arquivo (`conferidos_img_unidade_17_comp_11-2026.xlsx`) é baixado e, com a pasta conectada, gravado em `09 - Planilhas de repasse conferidos › IMG › nome da unidade`. Abas:
- **Prestadores:** uma linha por prestador, com:
  - situação e aceite;
  - laudos no Apolo e linhas do MV;
  - Devido, Aceito, Para pagamento, Pendente, NC e Excluído.

  Também entra quem laudou e não tem relatório (Gerar no MV, Sem cadastro). A última linha é o TOTAL da unidade.
- **Conferência:** as linhas de todos os prestadores, com o código e o nome do prestador nas duas primeiras colunas, para filtrar.
- **O que falta decidir**, **Por procedimento** e **Informações**.

Cada relatório é conferido de novo na hora, com os parâmetros da última rodada dele e as decisões já registradas. Gerar o Excel único **não** grava rodada nova. Relatório ainda sem conferência aparece só na aba Prestadores, como «Relatório sem conferência».

## 8. Rodadas guardadas (desde a v3.0.0-alpha.10)
- A ferramenta lê as rodadas da competência aberta e das vizinhas. Para ver todas, use Rodadas → «mostrar todas as competências».
- **Rodadas que ficam inteiras**, de cada relatório:
  - as que têm aceite;
  - a mais recente de cada um dos 3 últimos PDFs.
- **Rodadas resumidas:** as outras guardam só o resumo (arquivos, versões, contagens). Aparecem como «resumida» e não recebem aceite.
- O backup leva as rodadas da competência aberta.

## Vários exames do paciente no mesmo dia (v3.0.0-alpha.23)
Quando o paciente fez mais de um USG no mesmo atendimento (ex.: abdome total, transvaginal e tireoide) e as equivalências desses títulos ainda não estão validadas, a ferramenta usa o **título do laudo** para saber qual laudo é de qual linha do MV.

- No detalhe da linha, cada laudo candidato mostra **«título N%»**: quanto do título aparece na descrição do procedimento no MV.
- Se o laudo escolhido fica claramente acima dos outros (pelo menos 40% e 25 pontos acima de cada alternativa), a linha recebe o marcador **«Laudo escolhido pelo título»** e não fica «Mais de um laudo plausível».
- A linha **continua Pendente** enquanto a equivalência não for validada. Em «O que falta decidir», o grupo «Sem equivalência cadastrada» já traz o par certo: validando, as próximas conferências ficam «Conferido».
- Se os títulos não dizem o exame (ex.: «Exame de imagem»), a linha continua «Mais de um laudo plausível» e aparece na decisão linha a linha. Escolha o laudo certo no detalhe da linha.
