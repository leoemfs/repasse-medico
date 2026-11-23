# Como usar o Fluxo mensal

## Uma vez só: preparar o modelo

1. Abra **Fluxo mensal → Modelo e prazos**.
2. **Marcos e regras de prazo**: confira as regras (5º dia útil, dia 15, último dia útil, 5 dias corridos antes do pagamento…). A coluna da direita mostra a data que cada regra gera no mês escolhido.
3. **Grupos de fluxo** (clique para abrir cada um):
   - renomeie, acrescente ou remova etapas; defina o prazo, de quem ela depende (aviso, não bloqueio) e se ela pode ser comprovada por uma rodada da ferramenta;
   - **Prestadores deste fluxo**: é a lista do controle documental (relatório, NF, Financeiro). Cadastre uma vez: ela é copiada para cada mês novo. Atalho: carregue os PDFs do MV no Início e use «Importar dos relatórios do MV carregados», que pega o prestador do cabeçalho de cada PDF;
   - **Regras fixas**: avisos que aparecem todo mês (ex.: «Não repassar UNIMED dos anestesistas das unidades 17 e 2»).
4. Clique em **Salvar modelo**.

## Todo mês

1. **Acompanhamento** → use ‹ › para chegar à competência → **Iniciar competência**. O mês nasce com uma cópia do modelo: mudar o modelo depois não altera meses já iniciados (use «Aplicar ao mês» se quiser levar etapas novas para o mês corrente).
2. Abra um grupo e, em cada etapa, escolha o **status**. Início e conclusão são preenchidos com a data do dia (dá para corrigir). Concluir uma etapa nunca conclui a seguinte.
3. **Prazo** de uma etapa: clique na data para ajustar só neste mês (exige justificativa quando muda um prazo calculado).
4. **Marcos** (faixa de datas): clique em um marco para registrar a data efetiva (ex.: pagamento antecipado). Os prazos que dependem dele são recalculados.
5. **Rodada vinculada**: depois de rodar uma conferência ou correção de prestador na ferramenta, a etapa mostra «rodadas neste mês». Clique, escolha a rodada e, se quiser, marque «concluída». Nada é concluído sozinho.
6. **Controle documental**: para cada prestador, preencha a data de envio do relatório e da prévia, da NF recebida e da NF encaminhada ao Financeiro. São três registros independentes. Prestador extra só neste mês: «+ Prestador»; para os próximos meses também: «Salvar esta lista no modelo».
7. **Classificação**: informe a produção bruta de USG e a classe (A/B/C/D) de cada prestador do IMG. Nada é calculado automaticamente.
8. **Andamento por unidade** (IMG): status de cada unidade, que avança no seu ritmo.
9. **Observações da seção** e **Anotações da competência**: o lugar do bloco de notas e das anotações no e-mail.
10. **Filtros** (Vencidas, Vencem em 3 dias, Aguardando terceiros…) e **Exportar situação (.xlsx)** para enviar o andamento a alguém.

## Fim do mês: Retrospectiva (PDCA)
Na subaba **Retrospectiva** do Fluxo mensal ficam os indicadores da competência escolhida no topo. Todos são calculados com o que já foi registrado:
- **Lead time** (em dias úteis): geração no MV → 1ª conferência → aceite → e-mail → NF → Financeiro, por prestador e por etapa. A etapa mais demorada aparece como **gargalo do mês**. Para a geração ter a data certa, conclua a etapa «Gerar» do grupo no checklist. Sem ela, a ferramenta usa o marco do modelo.
- **Rodadas até o aceite**, **espera por terceiros** (etapas e prestadores marcados como «Aguardando terceiros»), **cobertura de equivalências**, **NCs por natureza e faturista** (com reincidência nos últimos 3 meses) e **antecedência da entrega ao Financeiro** contra a meta de dias úteis.
- **Comparação entre meses:** a competência e os 3 meses anteriores; ▲▼ em verde quando melhorou e em vermelho quando piorou.
- **O que melhorar no próximo mês:** escreva cada combinado da reunião e, se quiser, ligue-o a um indicador. Esses itens viram o **backlog** do mês seguinte, onde são marcados como Em andamento, Feita ou Descartada. O que ficar em aberto segue para os próximos meses. Os itens vão para a pasta da rede junto com o Fluxo.
- **Exportar retrospectiva (.xlsx)** gera uma planilha com tudo isso, para levar à reunião.

## Onde ficam os dados

No armazenamento deste navegador, sem dados de pacientes. Faça **Configurações → Exportar backup** regularmente; o backup inclui o fluxo mensal. Para trabalhar junto com outra pessoa, use a pasta da rede (abaixo).

## Trabalhar em dupla: Fluxo na pasta da rede

1. **Uma vez só:** crie na rede uma pasta só para isso, por exemplo `Repasse Médico\Fluxo compartilhado`. Não precisa de subpastas por competência: a ferramenta cria um arquivo por competência (`fluxo_comp_10-2026.json`).
2. **Em cada computador (Edge ou Chrome):** Início → **Conectar a pasta raiz…** → escolha a pasta raiz do aplicativo (a que contém «Fluxo mensal», «Equivalência TUSS», «Bases de dados») → permita o acesso. Depois, **Criar pastas da competência** monta as pastas do mês com os nomes certos. Se o Edge oferecer «permitir sempre», marque; senão, ao abrir a ferramenta, clique em **Liberar acesso** na barra.
3. **No dia a dia:** a barra no topo do Fluxo mostra «Sincronizado» e quem gravou por último. As mudanças vão para a pasta sozinhas, e as do colega chegam ao entrar no Fluxo ou em até 30 segundos. **Atualizar agora** força na hora.
4. **Dividir as unidades:** na subaba **Divisão do trabalho** do Fluxo, clique em **Assumir** na unidade que você vai fazer. O colega vê o seu nome e o que falta nela. Ao terminar, **Concluir**; para devolver, **Liberar**. Se você abrir na Conferência uma unidade que está com o colega, aparece um aviso (não bloqueia). As unidades aparecem em blocos separados (**USG**, **IMG** e **Curitiba**), cada um com quantas já foram concluídas. As fichas acima dos blocos filtram por usuário: **Todos**, **Você**, uma ficha para cada colega com unidade e **Livres**.
5. **Os dois mudaram a mesma etapa:** a ferramenta pergunta qual versão fica e guarda o histórico das duas.
6. **Rede fora do ar:** a barra fica amarela e as mudanças ficam no navegador até a pasta voltar.

Vai para a pasta só o Fluxo (etapas, status, datas, anotações, controle documental e divisão). Conferências, aceites, NCs, cadastro e equivalências continuam no navegador de cada um.
