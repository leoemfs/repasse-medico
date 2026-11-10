# Repasse Médico v3.0.0-alpha.1 — notas da versão

A 3.0 consolida a ferramenta: ela fica mais rápida e mais segura para duas pessoas trabalharem juntas, e as configurações passam a ficar num lugar só. As regras da conferência, das equivalências, da correção de prestador e do fechamento **não mudaram**. A análise completa, com prioridades, está em [`v3.0-auditoria.md`](v3.0-auditoria.md).

## O que muda no dia a dia

### Conferência e correção mais rápidas
Um relatório de 2.000 linhas contra 27 mil laudos levava cerca de 9 segundos, com a tela travada. Agora leva cerca de 0,3 s. O resultado é exatamente o mesmo, linha a linha.

### Equivalências → «Títulos do Apolo»
1. Carregue a planilha de laudos (Início ou «Atualizar da pasta»).
2. Em **Equivalências TUSS → Títulos do Apolo**, aparece um título por linha, com quantos laudos ele tem. Os que faltam resolver vêm primeiro, começando pelos mais frequentes.
3. Clique no título. À direita aparecem:
   - exemplos (sem nome de paciente);
   - o que já existe na base;
   - sugestões de procedimento.
4. Marque a sugestão certa, ou procure pelo código ou pelo nome.
5. Confirme. Com dois ou mais procedimentos, escolha:
   - **Juntos:** abre a regra composta para ajustar quantidade e convênio;
   - **Um ou outro:** qualquer um dos códigos confirma o laudo.
6. O próximo título pendente já fica selecionado.

As sugestões **nunca** validam sozinhas.

### Configurações em um lugar só
**Configurações** tem categorias:

| Categoria | O que tem |
|---|---|
| Geral | operador, tema, cor de destaque |
| Conferência | parâmetros, planilhas guardadas |
| Bases e regras | unidades, prestadores, aliases, regras, convênios e faturistas |
| Pastas e sincronização | pasta raiz, nomes das subpastas, onde gravar os Excel |
| Exportação | modelos de colunas |
| Backup e dados | backup, restauração e armazenamento |
| Sobre | versão e atualização |

No menu, «Bases e regras» e «Configurações» ficam no grupo **CONFIGURAÇÕES**, e «Equivalências TUSS» foi para o grupo do trabalho do mês.

### Trabalho em dupla pela pasta da rede
Além do Fluxo e das equivalências, agora a **configuração** também vai para a pasta (`Configuração compartilhada`): unidades, prestadores e aliases, regras de repasse, faturistas, convênios, parâmetros e modelos de exportação.
- O que cada pessoa muda em itens diferentes se junta sozinho.
- Se as duas mudarem o mesmo item, a ferramenta pergunta qual versão fica.
- Restaurar um backup antigo não passa mais por cima do que a outra pessoa decidiu depois: o que divergir vira escolha.

### Backups
- O backup leva tudo o que é seu na ferramenta: configuração, equivalências, fluxo, competências, controle por unidade, preferências e, se marcado, NCs e rodadas.
- Antes de restaurar, você vê o que tem no arquivo e escolhe as partes.
- Arquivo incompleto ou alterado é recusado.
- Com a pasta conectada, a ferramenta grava um **backup automático por dia** em `backups` (nome configurável), mantém os últimos 30 e permite restaurar direto da lista.

### Exportação
Em **Configurações → Exportação**, escolha o modelo da aba principal do Excel da conferência:
- **Padrão:** o layout atual;
- **Completo:** com conta, atendimento e IDs;
- ou crie o seu: marque as colunas, ordene com ↑ ↓ e salve.

Com a pasta conectada, os Excel da conferência, da correção e das NCs podem ir direto para a pasta da competência.

### Não conformidades
O histórico da NC mostra o que mudou (valor anterior → novo) e a data da última atualização.

### Aplicativo e atualização
- **Instalar:** no Edge, use **… → Aplicativos → Instalar este site como aplicativo**. A ferramenta abre em janela própria.
- **Versão nova:** quando uma versão nova é publicada, aparece um aviso fixo **«Atualizar agora»**. Ele espera a sincronização com a pasta terminar antes de recarregar.

## Atenção na primeira vez
- **Configuração compartilhada:** a primeira pessoa que abrir a 3.0 com a pasta conectada cria a configuração na pasta. A segunda junta a dela com a da pasta. Se as duas tiverem mudado o mesmo item, a ferramenta pergunta qual versão fica.
- **NCs e rodadas:** as não conformidades e as rodadas (aceites) ainda ficam em cada navegador. Compartilhá-las é o próximo passo (P1-6 na auditoria).
