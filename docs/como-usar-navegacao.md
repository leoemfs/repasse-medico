# Como usar: navegação simplificada (desde a v3.0.0-alpha.20)

A ferramenta ficou com **7 itens no menu**, em vez de 10. Nenhuma regra de negócio mudou: as mesmas telas foram reagrupadas. A prévia aprovada está em `docs/prototipos/simplificacao-navegacao.html`.

## Menu

| Grupo | Item | O que tem dentro |
|---|---|---|
| Trabalho do mês | **Início** | Painel do dia: marcos, arquivos do mês, andamento, «Pede você», relatórios do mês e fechar a competência |
| | **Conferência** | Conferência cruzada · Correção de prestador · Histórico de rodadas (seletor no topo) |
| | **Equivalências TUSS** | sem mudança |
| | **Não conformidades** | sem mudança |
| | **Fechamento e envio** | Etapas do mês (antes «Fluxo mensal») · Repasse USG · Repasse IMG · Repasse Curitiba (V3) · Produção USG e classe · Indicadores |
| Configurações | **Bases e regras** | «Usados no mês» (prestadores, unidades, convênios, faturistas) e «Avançado» (classes IMG, tipo de item, modalidades e HM V3, Power BI) |
| | **Configurações** | Geral · Conferência · Pastas e sincronização · Modelo do fluxo · Exportação · Backup · Sobre |

Os endereços antigos continuam funcionando: `#correcao` e `#rodadas` abrem dentro da Conferência, e `#fluxo` abre as Etapas do mês.

## Início
- **Hoje:** o dia, a competência e os marcos próximos. Clicar num marco abre as Etapas do mês.
- **Arquivos do mês:**
  - a situação do MV, do Apolo e do Power BI, com «ok» ou «outro mês»;
  - os quadros de carregar ficam em «Carregar manualmente…»; com a pasta raiz conectada, os arquivos chegam sozinhos.
- **Andamento:**
  - etapas por repasse, com as vencidas;
  - conferências e NCs;
  - cobertura automática.
- **Pede você:** o que está parado esperando alguém (relatórios sem conferência, rodadas sem aceite, equivalências pendentes, NCs abertas, etapas vencidas ou vencendo), com o botão que leva até lá.
- **Relatórios do mês:** a lista de PDFs, com os filtros de antes.
- **Fechar a competência:** no fim da página. As bases alteradas no mês ficam recolhidas ali.

## Conferência
- **O que conferir:** relatório, unidade dos laudos, tolerância e médico do laudo.
  - A unidade vem da pasta ou do nome do arquivo.
  - O médico vem do cadastro do prestador.
- **Topo do resultado:**
  - **para pagamento** (Devido + Aceito) em destaque;
  - as 5 classes, e clicar numa classe filtra a tabela;
  - a barra por classe.
- **Situações** (Conferido, Pendente, Só no laudo…) viram etiquetas ao lado da busca. A situação aparece em cada linha, embaixo da classe.
- **Filtros:**
  - os 7 filtros (procedimento, data de/até, convênio, título, médico do laudo, observação) ficam no botão «Filtros»;
  - os ativos aparecem como etiquetas; clique no ✕ para tirar.
- **Decisões em lote:**
  - marque as linhas (caixinha à esquerda) e use a barra azul;
  - sem marcar nada, com um filtro escolhido, o lote vale para as linhas do filtro, como antes.
- **Linha aberta:**
  - MV × laudo lado a lado, campo por campo, com a diferença destacada;
  - depois de decidir, a próxima linha que falta decidir abre sozinha.
- **Aba «Histórico e detalhes»:** as rodadas deste relatório (quando, quem, PDF, valor para pagamento e aceite) e os detalhes de antes. A lista de todas as rodadas está em Conferência › Histórico de rodadas.
- **Um só «Exportar Excel»:** «Exportar só o filtrado» (ou «só as marcadas») continua na faixa da tabela.

## Fechamento e envio
- **Etapas do mês** (o checklist do antigo Fluxo mensal):
  - **Marcos da competência** primeiro: clique na data para ajustar, com justificativa;
  - em seguida, os indicadores, os filtros (Vencidas, Vencem em 3 dias, Aguardando terceiros…) e as etapas de cada repasse.
  - «Quem faz o quê», «Retrospectiva» e «Modelo e prazos» ficam como links no alto da tela.
- **Envio na linha do prestador.** Em cada repasse, embaixo da situação de cada prestador, há três marcações: **E-mail**, **NF recebida** e **NF ao Financeiro**.
  - Clicar grava a data de hoje; clicar de novo desfaz.
  - É o mesmo controle documental de antes: nas Etapas do mês, «Envio e NF por prestador» mostra a contagem e a lista, recolhida.
- **Situações como filtro.** Os quadros Verificar, Sem valores, A enviar, Enviado e Concluído filtram a tabela. «Ver como quadro» mostra as mesmas situações em colunas.
- **Exportar:** Planilha de controle · Indicadores · Pasta da competência, juntos no topo.
