# Auditoria técnica e funcional — 16/11/2026 (sobre a v3.0.0-alpha.6)

Feita sem alterar código. As medições usaram dados fictícios no volume real (30 mil laudos; relatórios de 2 a 3 mil linhas). Esta é a lista de trabalho das próximas sessões.

## P0 — erros confirmados que afetam o valor pago (fazer primeiro)

1. **A NC de um laudo «Só no laudo» é herdada pelo lançamento que o MV fez depois para corrigir.**
   - A NC «não lançado» é gravada pela chave do laudo (`L|idLaudo`). Na rodada seguinte, depois de o MV lançar o procedimento, a linha forma par com o laudo e herda a decisão NC. Resultado: classe NC, fora do fechamento, mesmo estando conferida.
   - Causa: `decisaoDaLinha` / `decisaoDaLinhaRodada` (`src/engine/84-decisoes.js`, `63-classes.js`) procuram pela chave do MV **e** pela chave do laudo.
   - Correção esperada: uma NC registrada pela chave do laudo não deve passar para uma linha do MV que agora tem par. Se fizer sentido, essa NC aparece como «corrigida no MV» na aba «NCs e correções no MV».
2. **Uma linha repetida no MV divide a mesma chave de decisão.**
   - `chaveMVDecisao` (`84-decisoes.js`) é `M|conta|atendimento|código|data`, sem a ordem da repetição (`r.chave` tem essa ordem; `kd` não).
   - Ao registrar NC na cobrança duplicada («Esta é a repetida → NC»), as **duas** linhas viram NC.
   - Correção esperada: incluir a ordem da repetição (`r.repeticao.i`) na chave apenas quando houver repetição, para manter as chaves já gravadas das linhas únicas.

Os dois foram reproduzidos por teste. Escrever um teste para cada um junto com a correção.

## P1

- **Candidatos a NC crescem sem limite.** `guardarCandidatosNC` (`src/ui/35-nc.js`) grava todos os candidatos de cada conferência, com nome de paciente, em `rm2.nc`. Uma conferência de 2.000 linhas sem filtro de médico gerou 4.000 itens, cerca de 2,4 MB. Guardar só o escopo do médico, ou só as chaves, e regerar ao abrir.
- **Rodadas sem retenção e lidas inteiras a cada tela.** Uma rodada de 2.000 linhas ocupa ~650 KB. `dbTodas()` é chamada ao abrir Conferência, Fechamento, Fluxo, Rodadas, Compostas, Destrava e Prestadores por unidade. Ler só a competência atual (índice no IndexedDB), ter retenção e incluir no backup só as rodadas da competência.
- **Reconferir em um clique.** Botão «Reler o PDF da pasta e conferir de novo» no resultado da conferência, mantendo unidade, médico e aba. Hoje são 4 ou 5 passos.
- **Excel lento sem retorno.** O botão chama `entregarArquivo` direto: 30 mil linhas levam 2,2 s para montar e 4,4 s para gerar, com a tela congelada. Mostrar «Processando…» e oferecer «exportar só o filtrado».
- **Escopo do «Só no laudo».** Usar o médico do prestador como padrão quando houver cadastro, para reduzir o ruído e o volume de candidatos.

## P2

- **Pior caso da conferência: 6,8 s** (30 mil laudos, muitos homônimos). O perfil mostrou `simToken` e `norm` repetidos. Guardar a chave do título e o convênio normalizado no laudo ao ler o Apolo, e memorizar `avaliarProcedimento` por (código, título, modalidade, convênio). As regras não mudam.
- **Funções redefinidas por arquivos posteriores.** `salvarCfg`, `salvarEq`, `salvarFluxo`, `restaurarPastaSync` (envolvida 3 vezes) e `RENDER.*` são substituídas em outros arquivos. Trocar por ganchos explícitos e juntar as três sincronizações (Fluxo, Equivalências, Configuração) num módulo só.
- **A tela de Equivalências grava ao abrir.** `aplicarCobertas` com `gravarLocal` roda na renderização. Tirar a gravação de lá.
- **Testes.** Criar testes com dados fictícios para os fluxos que hoje dependem de `dados/`, e rodar os testes no GitHub a cada envio.
- **Expressões regulares.** `classificarItem` compila as expressões a cada linha. Pré-compilar uma vez por conferência.

## P3

- **Código sem uso.** Remover `celulasLaudo`, `conferirProducao`, `datalistFaturistas`, `datalistUnidades`, `regraDoFormulario`, `ligarCorrecoesMV` (vazia) e o CSS `.cf-b-*`.
- **Modo celular.** Gaveta, barra inferior e `test/menu.mjs`. Confirmar com o usuário se pode sair.
- **Textos desatualizados.** «Modo local: nada é enviado à internet».
- **Regras que só mudam com nova versão.** Tornar configuráveis a modalidade por grupo (`GRUPO_MODALIDADES`) e a regra de HM da V3 (`hmV3Devido`).

## Riscos conhecidos (intencionais, apenas monitorar)

- **Faixa 7** (nome só semelhante + mesma data + sem equivalência) forma par pendente e pode «gastar» o laudo de um homônimo.
- **Pareamento guloso:** é por faixa, sem busca do melhor arranjo global.
- **Exceção por convênio:** casa por trecho do nome (`includes`).
- **Pasta da rede:** gravação simultânea no mesmo milissegundo ainda pode perder uma alteração (documentado na auditoria v3.0, P1-8).

## Medições de referência

| Operação | Volume | Tempo |
|---|---|---|
| Ler o Apolo | 30 mil laudos | 0,6 s |
| Conferir pela tela | 2.000 linhas × 6 mil laudos | 0,7 s |
| Conferir, pior caso | 3.000 linhas × 30 mil laudos com homônimos | 6,8 s |
| Excel | 30 mil linhas | 6,6 s |
| Candidatos a NC | 1 conferência | 2,4 MB |
