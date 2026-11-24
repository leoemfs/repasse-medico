# Regras de trabalho deste repositório

- **Sempre prévia primeiro.** Antes de implementar qualquer mudança de tela ou de fluxo, mostrar uma prévia visual navegável, **sem código do app**, com **fidelidade visual ao aplicativo** (o `src/styles.css` real, o menu e os ícones de `src/index.html`) e dados fictícios. Só implementar depois que o usuário aprovar a prévia.
  - **A prévia é um artefato do claude.ai** (ferramenta Artifact), não um arquivo no repositório. Decisão do usuário de 23/11/2026, para gastar menos.
  - **Base reaproveitável:** um artefato com o CSS, o menu e os ícones do app, publicado como arquivos (`files`). Cada prévia nova traz só o conteúdo da tela e referencia esses arquivos. Republicar a base só quando `src/styles.css` ou o menu mudar.
  - **Sem ciclos de captura de tela:** conferir só que a página abre sem erro de script; quem avalia o visual é o usuário, no link.
  - **Nada de commit ou PR por prévia.** Só a versão **aprovada** vai para `docs/prototipos/`, no mesmo commit da implementação. A solicitação é registrada em `docs/proximas-funcoes.md` com o link do artefato.
- Pedidos de «só registre / documente» não mexem no código: vão para `docs/proximas-funcoes.md`.
- Regras de negócio só em `src/engine/`; testes e publicação conforme o README.
