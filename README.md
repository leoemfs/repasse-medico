# Repasse Médico v2 (alpha)

Aplicação local, em um único HTML, para conferir o repasse médico: relatório do MV (PDF) × laudos do Apolo (xlsx), com base de equivalências TUSS validada e identificação de prestador. Especificação: documentação v1.6 (RN-178 a RN-215).

## Estrutura

| Pasta | Conteúdo |
| --- | --- |
| `src/engine/` | Motor sem interface: leitura do MV, xlsx, Apolo/Power BI, configuração, equivalências, conferência, correção de prestador, rodadas e relatórios |
| `src/ui/` | Telas: início, fluxo mensal, conferência, correção, não conformidades, fechamento, equivalências, bases, rodadas e configurações |
| `src/index.html`, `src/styles.css` | Modelo da página |
| `lib/` | pdf.js 4 (legacy) e JSZip 3.10.1, embutidos em base64 no build |
| `tools/build.mjs` | Gera `dist/Repasse_Medico_v<versão>.html` |
| `test/` | `motor.mjs` (motor no Chromium), `e2e.mjs` (ponta a ponta, por file://) `menu.mjs` (navegação), `fluxo.mjs` (fluxo mensal), `nc.mjs` (não conformidades), `competencia.mjs` (competência no topo) e `calendario.mjs` (dias úteis) |
| `docs/` | Especificações, requisitos em levantamento e guias de uso |
| `dados/` | Arquivos reais para teste. **Fora do Git** (dados de pacientes) |

## Comandos

```bash
node tools/build.mjs            # gera o HTML final em dist/
node tools/build.mjs --harness  # gera dist/harness.html para test/motor.mjs
node test/motor.mjs             # motor com os arquivos de dados/
node test/e2e.mjs               # interface completa com os arquivos de dados/
node test/menu.mjs              # menu recolhível, Ctrl+B e barra do celular
node test/fluxo.mjs             # fluxo mensal (com data fixa em 29/10/2026)
node test/nc.mjs                # não conformidades com os arquivos de dados/ (data fixa em 30/10/2026)
node test/competencia.mjs       # competência no topo, encapsulamento, fechar/reabrir (data fixa em 30/10/2026)
node test/decisoes.mjs          # desfazer conflito e memória das decisões por linha
node test/regras.mjs            # regras de repasse em Bases e importação da planilha de controle
node test/fechamento.mjs        # aba Fechamento: valores com aceite, situação, prévia do e-mail e exportação
node test/calendario.mjs        # dias úteis, feriados nacionais e marcos (Node puro)
```

## Regras de desenvolvimento

1. Regra de negócio só em `src/engine/`; as telas apenas chamam o motor.
2. Toda mudança começa como solicitação com critério de aceite; o teste entra junto.
3. Uma versão por vez; `MOTOR_VERSAO` em `src/engine/00-util.js` sobe a cada entrega.
4. Antes de entregar: `motor.mjs` e `e2e.mjs` sem erros, Excels reabertos e totais reconciliados.
